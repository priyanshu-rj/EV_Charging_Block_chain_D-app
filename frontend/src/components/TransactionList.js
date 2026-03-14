import React from "react";

function TransactionList({ transactions }) {
  if (!transactions || transactions.length === 0)
    return <p>No transactions yet</p>;

  return (
    <div className="transactions" style={{ lineHeight: "1.6" }}>
      <h3>📄 Blockchain Transactions</h3>
      {transactions.map((tx, idx) => (
        <div
          key={idx}
          style={{
            marginBottom: "12px",
            padding: "10px",
            borderRadius: "8px",
            backgroundColor: "#f8f9fa",
            border: "1px solid #ddd",
          }}
        >
          {tx.from_user && (
            <>
              <p>
                🔹 <strong>From:</strong> {tx.from_address}
              </p>
              <p>
                🔹 <strong>To:</strong> {tx.to_address}
              </p>
              <p>
                ⚡ <strong>Energy Used:</strong> {tx.energy_kwh} kWh
              </p>
              <p>
                💰 <strong>Amount:</strong> ₹{tx.amount_local}
              </p>
              <p>
                🕒 <strong>Time:</strong>{" "}
                {new Date(tx.timestamp).toLocaleString()}
              </p>
            </>
          )}
          {tx.tx_hash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${tx.tx_hash}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#007aff" }}
            >
              🔗 View on Etherscan
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

export default TransactionList;
