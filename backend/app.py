from flask import Flask, jsonify, request
from flask_cors import CORS
from web3 import Web3
from web3.providers.eth_tester import EthereumTesterProvider
from datetime import datetime
import json, os, secrets, hashlib

# battery info
try:
    import psutil
except ImportError:
    psutil = None


# set paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
USER_FILE = os.path.join(BASE_DIR, "user.json")
PAYMENTS_FILE = os.path.join(BASE_DIR, "payments.json")
ABI_FILE = os.path.join(BASE_DIR, "contract_abi.json")
BLOCKCHAIN_FILE = os.path.join(BASE_DIR, "blocks.json")  # added file for blocks


app = Flask(__name__)
CORS(app)


# Web3 Fake blockchain

w3 = Web3(EthereumTesterProvider())
tester = w3.provider.ethereum_tester
accounts = w3.eth.accounts
print("Pre-funded test accounts:", accounts)

#  ABI

CONTRACT_ABI = []
if os.path.exists(ABI_FILE):
    try:
        with open(ABI_FILE, "r") as f:
            CONTRACT_ABI = json.load(f)
    except Exception as e:
        print("Failed to parse ABI:", e)

# helpers

def read_json(path, default):
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        with open(path, "w") as f:
            json.dump(default, f, indent=2)
        return default
    with open(path, "r") as f:
        return json.load(f)

def write_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


#  storage

default_users = {
    "owner": {
        "id": "owner",
        "name": "FuelStation",
        "balance": 100.0,
        "address": accounts[0],
        "password_hash": ""
    }
}
USERS = read_json(USER_FILE, default_users)
PAYMENTS = read_json(PAYMENTS_FILE, [])

def save_users():
    write_json(USER_FILE, USERS)

def save_payments():
    write_json(PAYMENTS_FILE, PAYMENTS)

def now_iso():
    return datetime.utcnow().isoformat() + "Z"

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, hashed):
    return hash_password(password) == hashed


# --------------------------
# BLOCKCHAIN / MERKLE STORAGE
# --------------------------

# load or initialize blocks
def load_blocks():
    return read_json(BLOCKCHAIN_FILE, [])

def save_blocks(blocks):
    write_json(BLOCKCHAIN_FILE, blocks)

# flexible sha256 helper:
def sha256_of(value):
    """
    If value is a Python object (dict/list), produce deterministic hash of its JSON.
    If value is already a hex string, hash the string bytes.
    """
    if isinstance(value, (dict, list)):
        data = json.dumps(value, sort_keys=True)
    else:
        data = str(value)
    return hashlib.sha256(data.encode()).hexdigest()

def build_merkle_root(transactions):
    """
    transactions: list of tx objects (dictionaries)
    returns: hex sha256 merkle root (string)
    """
    if not transactions:
        return ""

    # start with leaf hashes (deterministic)
    hashes = [sha256_of(tx) for tx in transactions]

    while len(hashes) > 1:
        next_level = []
        for i in range(0, len(hashes), 2):
            left = hashes[i]
            right = hashes[i + 1] if i + 1 < len(hashes) else left
            # parent is hash of concatenated child hex strings
            parent = sha256_of(left + right)
            next_level.append(parent)
        hashes = next_level

    return hashes[0]


# in-memory blocks + tx buffer
BLOCKS = load_blocks()
MAX_TX_PER_BLOCK = 10
TX_BUFFER = []  # holds payments that will go into next block (ordered newest-first as PAYMENTS does)


def try_form_block():
    """
    New behavior:
    - Do NOT modify or delete payments.json (PAYMENTS).
    - Create a block as soon as there is at least 1 payment that is NOT already included in blocks.json.
    - Each block contains up to MAX_TX_PER_BLOCK transactions.
    - Transactions already present in any block will not be included again.
    - Persist only blocks.json (BLOCKS).
    """
    global BLOCKS, PAYMENTS, TX_BUFFER

    # Build set of payment IDs already included in existing blocks
    included_ids = set()
    for b in BLOCKS:
        for tx in b.get("transactions", []):
            if isinstance(tx, dict) and "id" in tx:
                included_ids.add(tx["id"])

    # Build a list of candidate payments (newest-first) that are NOT yet included
    new_payments = [p for p in PAYMENTS if p.get("id") not in included_ids]

    # Sync TX_BUFFER if empty: keep newest-first ordering
    if not TX_BUFFER and new_payments:
        to_take = min(MAX_TX_PER_BLOCK, len(new_payments))
        TX_BUFFER = new_payments[:to_take].copy()

    # If buffer empty (no new payments), nothing to do
    if len(TX_BUFFER) == 0:
        return

    # --- CREATE BLOCK using up to MAX_TX_PER_BLOCK from TX_BUFFER ---
    block_txs = TX_BUFFER[:MAX_TX_PER_BLOCK].copy()

    prev_hash = BLOCKS[-1]["hash"] if BLOCKS else "0" * 64
    merkle_root = build_merkle_root(block_txs)

    block = {
        "index": len(BLOCKS),
        "timestamp": now_iso(),
        "transactions": block_txs,
        "txCount": len(block_txs),
        "prevHash": prev_hash,
        "merkleRoot": merkle_root
    }
    # block hash computed from prevHash + merkleRoot + index + timestamp for uniqueness
    block["hash"] = sha256_of(prev_hash + merkle_root + str(block["index"]) + block["timestamp"])

    # append and persist only blocks.json (do NOT modify PAYMENTS)
    BLOCKS.append(block)
    save_blocks(BLOCKS)

    # After making block, remove those transactions from the buffer (but keep payments.json intact)
    TX_BUFFER = TX_BUFFER[len(block_txs):]

    # Refill TX_BUFFER from PAYMENTS/new_payments (skip included ones)
    # Build fresh new_payments (because included_ids must include the ones we just used)
    included_ids.update({tx.get("id") for tx in block_txs if isinstance(tx, dict) and "id" in tx})
    new_payments = [p for p in PAYMENTS if p.get("id") not in included_ids]
    if not TX_BUFFER and new_payments:
        TX_BUFFER = new_payments[:min(MAX_TX_PER_BLOCK, len(new_payments))].copy()

    print(f"Created Block {block['index']} with {len(block_txs)} transactions. merkleRoot={merkle_root}")


# Routes

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "time": now_iso()})

@app.route("/api/config")
def config():
    return jsonify({
        "battery_capacity_wh": 50.0,
        "price_per_kwh": 10.0,
        "currency": "₹"
    })


# User registration

@app.route("/api/register", methods=["POST"])
def register():
    body = request.json or {}
    username = str(body.get("username", "")).strip()
    password = str(body.get("password", "")).strip()

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    if username in USERS:
        return jsonify({"error": "Username already exists"}), 400

    addr_index = len(USERS) % len(accounts)
    USERS[username] = {
        "id": username,
        "name": username,
        "balance": 50.0,
        "address": accounts[addr_index],
        "password_hash": hash_password(password)
    }
    save_users()
    return jsonify({"message": "Registration successful", "user": USERS[username]})



# Manual payment (Ether)

@app.route("/api/manual_payment", methods=["POST"])
def manual_payment():
    global PAYMENTS, TX_BUFFER
    body = request.json or {}
    user_id = body.get("user_id")
    amount = body.get("amount")

    try:
        amount = float(amount)
    except Exception:
        return jsonify({"error": "Invalid amount"}), 400

    if not user_id or user_id not in USERS:
        return jsonify({"error": "User not found"}), 404

    if USERS[user_id]["balance"] < amount:
        return jsonify({"error": "Insufficient balance"}), 400

    station_id = "owner"  # Default
    USERS[user_id]["balance"] = round(USERS[user_id]["balance"] - amount, 4)
    USERS[station_id]["balance"] = round(USERS[station_id]["balance"] + amount, 4)
    save_users()

    #ETH transaction on eth-tester
    eth_value = w3.to_wei(amount * 0.00001, "ether")
    tx_hash_hex = None
    try:
        tx_hash = w3.eth.send_transaction({
            "from": USERS[user_id]["address"],
            "to": USERS[station_id]["address"],
            "value": eth_value
        })
        tx_hash_hex = tx_hash.hex()
    except Exception as ex:
        print("eth-tester manual payment error:", ex)

    # Save payment
    payment = {
        "id": secrets.token_hex(8),
        "timestamp": now_iso(),
        "from_user": user_id,
        "from_address": USERS[user_id]["address"],
        "to_station": station_id,
        "to_address": USERS[station_id]["address"],
        "manual_amount": amount,
        "eth_value_wei": eth_value,
        "tx_hash": tx_hash_hex
    }
    # newest-first insertion (keeps compatibility with prior logic)
    PAYMENTS.insert(0, payment)
    save_payments()

    # add to TX_BUFFER (mirror of PAYMENTS newest-first)
    TX_BUFFER.insert(0, payment)
    # If buffer length gets large, trim to keep consistent ordering (optional)
    if len(TX_BUFFER) > MAX_TX_PER_BLOCK:
        TX_BUFFER = TX_BUFFER[:MAX_TX_PER_BLOCK]

    # Try to form a block (new behavior: will create block as soon as there's >=1 new tx not in blocks)
    try_form_block()

    return jsonify({"message": "Manual payment completed", "payment": payment, "users": USERS})



# User login
@app.route("/api/login", methods=["POST"])
def login():
    body = request.json or {}
    username = str(body.get("username", "")).strip()
    password = str(body.get("password", "")).strip()

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    if username not in USERS:
        return jsonify({"error": "User not found"}), 404

    user = USERS[username]
    if not verify_password(password, user.get("password_hash", "")):
        return jsonify({"error": "Incorrect password"}), 401

    return jsonify(user)


# Get all users

@app.route("/api/users")
def get_users():
    return jsonify(USERS)


# Battery info 

@app.route("/api/battery")
def battery_info():
    if psutil and hasattr(psutil, "sensors_battery"):
        b = psutil.sensors_battery()
        if b:
            return jsonify({"percent": b.percent, "charging": b.power_plugged})
    return jsonify({"error": "no battery info available"}), 404


# Auto payment

@app.route("/api/charge_event", methods=["POST"])
def charge_event():
    global PAYMENTS, TX_BUFFER
    body = request.json or {}
    user_id = body.get("user_id")
    station_id = body.get("station_id", "owner")

    try:
        start = float(body.get("start", 0))
        end = float(body.get("end", 0))
    except Exception:
        return jsonify({"error": "invalid start/end values"}), 400

    if not user_id or user_id not in USERS or station_id not in USERS:
        return jsonify({"error": "user or station not found"}), 400

    # config
    capacity_wh = 50.0
    price_per_kwh = 10.0

    # payment cal
    energy_used_wh = capacity_wh * max(0.0, (end - start)) / 100.0
    energy_kwh = energy_used_wh / 1000.0
    amount_local = round(energy_kwh * price_per_kwh, 4)

    if energy_kwh <= 0:
        return jsonify({"message": "No energy used, no payment deducted"}), 200
    if USERS[user_id]["balance"] < amount_local:
        return jsonify({"error": "Insufficient balance"}), 400

    
    USERS[user_id]["balance"] = round(USERS[user_id]["balance"] - amount_local, 4)
    USERS[station_id]["balance"] = round(USERS[station_id]["balance"] + amount_local, 4)
    save_users()

    #ETH transaction
    eth_value = w3.to_wei(0.000001 * max(1, energy_kwh), "ether")
    tx_hash_hex = None
    try:
        tx_hash = w3.eth.send_transaction({
            "from": USERS[user_id]["address"],
            "to": USERS[station_id]["address"],
            "value": eth_value
        })
        tx_hash_hex = tx_hash.hex()
    except Exception as ex:
        print("eth-tester error:", ex)

    # Save payment
    payment = {
        "id": secrets.token_hex(8),
        "timestamp": now_iso(),
        "from_user": user_id,
        "from_address": USERS[user_id]["address"],
        "to_station": station_id,
        "to_address": USERS[station_id]["address"],
        "start_percent": start,
        "end_percent": end,
        "energy_kwh": round(energy_kwh, 6),
        "amount_local": amount_local,
        "eth_value_wei": eth_value,
        "tx_hash": tx_hash_hex
    }
    PAYMENTS.insert(0, payment)
    save_payments()

    # add to TX_BUFFER
    TX_BUFFER.insert(0, payment)
    if len(TX_BUFFER) > MAX_TX_PER_BLOCK:
        TX_BUFFER = TX_BUFFER[:MAX_TX_PER_BLOCK]

    # Try to form a block if we have enough transactions
    try_form_block()

    return jsonify({"message": "Auto payment completed", "payment": payment, "users": USERS})


# Get transactions

@app.route("/api/transactions")
def transactions():
    chain_txs = []
    try:
        latest_block = tester.get_block_by_number("latest")["number"]
        for blk in range(latest_block + 1):
            block = tester.get_block_by_number(blk)
            for tx in block["transactions"]:
                chain_txs.append(tx.hex())
    except Exception:
        pass
    return jsonify({"payments": PAYMENTS, "chain_tx_hashes": chain_txs})


# Blocks endpoints for frontend

@app.route("/api/blocks")
def get_all_blocks():
    """
    Returns stored blocks (persistent blocks.json)
    """
    return jsonify({"blocks": BLOCKS})

@app.route("/api/block/<int:index>")
def get_block(index):
    if index < 0 or index >= len(BLOCKS):
        return jsonify({"error": "Block not found"}), 404
    return jsonify(BLOCKS[index])


# Contract ABI
@app.route("/api/contract_abi")
def get_contract_abi():
    return jsonify(CONTRACT_ABI)




@app.route("/api/owner", methods=["GET"])
def get_owner():
    try:
        user_file = os.path.join(BASE_DIR, "user.json")
        with open(user_file, "r") as f:
            data = json.load(f)

        return jsonify({"owner": data["owner"]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
