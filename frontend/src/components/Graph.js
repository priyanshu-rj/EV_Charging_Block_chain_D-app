import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const MAX_POINTS = 6;

const Graph = () => {
  const [transactions, setTransactions] = useState([]);

  const fetchTransactions = async () => {
    try {
      const res = await axios.get(
        "http://127.0.0.1:5000/api/transactions?limit=6",
        { timeout: 3000 }
      );

      const payments = res.data.payments || [];

      // Convert API data → chart data
      const formatted = payments.map((tx) => ({
        timestamp: new Date(tx.timestamp).toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        energy: Number(tx.energy_kwh || 0),
        eth: Number(tx.amount_local || 0),
      }));

      // Always keep latest 6 points
      setTransactions(formatted.slice(-MAX_POINTS));
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  useEffect(() => {
    fetchTransactions(); // Load first time
    const interval = setInterval(fetchTransactions, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!transactions.length)
    return <div style={styles.loading}>Loading chart data...</div>;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Live Blockchain Transaction Graph</h2>

      <div style={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={transactions}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />

            <Line
              type="monotone"
              dataKey="energy"
              stroke="#4e73df"
              name="Energy (kWh)"
              dot={false}
            />

            <Line
              type="monotone"
              dataKey="eth"
              stroke="#1cc88a"
              name="ETH"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ------------------- INLINE STYLES -------------------
const styles = {
  container: {
    width: "95%",
    maxWidth: "900px",
    margin: "40px auto",
    textAlign: "center",
    fontFamily: "Arial",
  },
  title: {
    marginBottom: "20px",
  },
  chartContainer: {
    width: "100%",
    height: "400px",
    padding: "20px",
    background: "#f7f7f7",
    borderRadius: "10px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
  },
  loading: {
    textAlign: "center",
    marginTop: "40px",
    fontSize: "18px",
  },
};

export default Graph;
