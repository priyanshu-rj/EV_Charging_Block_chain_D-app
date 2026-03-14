import React, { useEffect, useState } from "react";
import axios from "axios";

export default function Owner() {
  const [blocks, setBlocks] = useState([]);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOwner();
    fetchBlocks();
  }, []);

  // 🔵 Fetch owner data
  async function fetchOwner() {
    try {
      const res = await axios.get("http://localhost:5000/api/owner");
      setOwner(res.data.owner);
    } catch (err) {
      console.error("Owner load error:", err);
    }
  }

  // 🔵 Fetch blocks list
  async function fetchBlocks() {
    try {
      const res = await axios.get("http://localhost:5000/api/blocks");
      setBlocks(res.data.blocks || []);
      setLoading(false);
    } catch (err) {
      console.error("Block load error:", err);
      setLoading(false);
    }
  }

  if (loading)
    return (
      <h2 style={{ textAlign: "center", marginTop: "40px" }}>
        Loading Owner Panel…
      </h2>
    );

  return (
    <div
      style={{
        padding: "25px",
        background: "#eef2ff",
        minHeight: "100vh",
        fontFamily: "Arial",
      }}
    >
      <h1 style={{ textAlign: "center", marginBottom: "20px" }}>
        ⚡ EV Charging Blockchain – Owner Dashboard
      </h1>

      {/* OWNER CARD */}
      {owner && (
        <div
          style={{
            width: "60%",
            margin: "0 auto 25px auto",
            background: "white",
            padding: "20px",
            borderRadius: "10px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
          }}
        >
          <h2>👤 Owner Details</h2>
          <p><strong>Name:</strong> {owner.name}</p>
          <p><strong>Address:</strong> {owner.address}</p>
          <p><strong>Balance:</strong> {owner.balance} ETH</p>
        </div>
      )}

      <p style={{ textAlign: "center", marginBottom: "20px" }}>
        ✔ Every 10 Transactions = 1 Block Generated
      </p>

      {blocks.length === 0 ? (
        <p style={{ textAlign: "center", marginTop: "20px" }}>
          No blocks created yet.
        </p>
      ) : null}

      {/* BLOCK LIST */}
      {blocks.map((block, idx) => (
        <div
          key={idx}
          style={{
            background: "white",
            padding: "20px",
            marginBottom: "25px",
            borderRadius: "12px",
            boxShadow: "0 3px 10px rgba(0,0,0,0.15)",
          }}
        >
          {/* HEADER */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "15px",
            }}
          >
            <h2 style={{ margin: 0 }}>Block #{block.index}</h2>
            <span style={{ color: "gray" }}>{block.timestamp}</span>
          </div>

          {/* BLOCK FIELDS */}
          <div style={{ fontSize: "14px" }}>
            <p>
              <strong>Previous Hash:</strong>
              <br />
              <span style={{ color: "#555" }}>{block.prevHash}</span>
            </p>

            <p>
              <strong>Merkle Root:</strong>
              <br />
              <span style={{ color: "#1a4fff" }}>{block.merkleRoot}</span>
            </p>

            <p>
              <strong>Block Hash:</strong>
              <br />
              <span style={{ color: "#2a7f22" }}>{block.hash}</span>
            </p>

            <p>
              <strong>Total Transactions:</strong> {block.txCount}
            </p>
          </div>

          <h3 style={{ marginTop: "20px" }}>Transactions</h3>

          {/* Transaction Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "15px",
              marginTop: "10px",
            }}
          >
            {block.transactions.map((tx, i) => (
              <div
                key={i}
                style={{
                  background: "#f5f7ff",
                  padding: "12px",
                  borderRadius: "10px",
                  borderLeft: "4px solid #4a77ff",
                  fontSize: "13px",
                }}
              >
                <p><strong>Tx ID:</strong> {tx.id}</p>
                <p><strong>User:</strong> {tx.from_user}</p>
                <p><strong>Address:</strong> {tx.from_address}</p>
                <p><strong>To:</strong> {tx.to_station}</p>

                <p>
                  <strong>Amount:</strong>{" "}
                  {tx.manual_amount ?? tx.amount_local ?? "N/A"}
                </p>

                {tx.energy_kwh && (
                  <p><strong>Energy:</strong> {tx.energy_kwh} kWh</p>
                )}

                <p>
                  <strong>Tx Hash:</strong>{" "}
                  {tx.tx_hash ? tx.tx_hash : "null"}
                </p>

                <p><strong>Time:</strong> {tx.timestamp}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
