import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Map from "./Map";
import Graph from "./Graph";

import {
  FaCarBattery,
  FaPlug,
  FaCarSide,
  FaMoneyBillWave,
  FaMoon,
  FaSun,
  FaCopy,
  FaCheckCircle,
  FaChartBar,
  FaThermometerHalf,
  FaCloudDownloadAlt,
} from "react-icons/fa";

function Dashboard({ user, setUser }) {
  const [users, setUsers] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [battery, setBattery] = useState({ level: 0, charging: false });
  const [chargingSession, setChargingSession] = useState(null);
  const [pendingCharge, setPendingCharge] = useState(null);
  const [showBlockchain, setShowBlockchain] = useState(false);
  const [manualPayAmount, setManualPayAmount] = useState("");
  const [showAddress, setShowAddress] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("dashboard_theme") === "dark";
    } catch {
      return false;
    }
  });
  const [showCharts, setShowCharts] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const scrollContainerRef = useRef(null);
  const unitCostPerKWh = 8;

  // Car info
  const car = {
    name: "Tata Nexon EV",
    capacityKWh: 40.5,
    rangeKm: 465,
    chargeTimeHours: 6.5,
    fastChargeMinutes: 56,
  };

  const chargingProcessedRef = useRef(false); 

 
  const loadUsers = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:5000/api/users");
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

 
  const loadTransactions = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:5000/api/transactions");
      let data = [];

      if (Array.isArray(res.data.payments)) data = res.data.payments;
      else if (Array.isArray(res.data.chain_tx_hashes))
        data = res.data.chain_tx_hashes;
      else if (Array.isArray(res.data)) data = res.data;

      const filteredTx = data.filter(
        (tx) =>
          tx.from_user?.toLowerCase() === user.name?.toLowerCase() ||
          tx.from_address?.toLowerCase() === user.address?.toLowerCase()
      );

      setTransactions(filteredTx);
    } catch (err) {
      console.error("Failed to load transactions:", err);
    }
  };

  
  const handleManualPay = async () => {
    const amount = parseFloat(manualPayAmount);
    if (!amount || amount <= 0) return alert("Enter valid amount!");

    try {
      const res = await axios.post("http://127.0.0.1:5000/api/manual_payment", {
        user_id: user.id,
        amount,
      });

      if (res.data?.users) setUsers(res.data.users);
      await loadTransactions();
      alert(`ETH ${amount.toFixed(2)} paid via manual.`);
      setManualPayAmount("");
    } catch (err) {
      alert("Manual pay failed: " + (err.response?.data?.error || err.message));
    }
  };

  // Confirm payment API
  const confirmPayment = async (chargeData) => {
    try {
      const res = await axios.post("http://127.0.0.1:5000/api/charge_event", {
        user_id: user.id,
        start: chargeData.start,
        end: chargeData.end,
        station_id: "owner",
      });

      if (res.data?.users) setUsers(res.data.users);
      
      const newBalance = (users[user.id]?.balance ?? 0) - chargeData.cost;
      setUser({ ...user, balance: newBalance });
      await loadTransactions();

      alert(
        `Paid: ETH ${chargeData.cost.toFixed(2)}\n` +
          `Charged: ${chargeData.chargedPercent.toFixed(1)}%\n` +
          `Energy: ${chargeData.energyUsed} kWh\n` +
          `Range: +${chargeData.rangeAdded} km\n` +
          `Time: ${chargeData.durationMinutes} min`
      );
    } catch (err) {
      console.error("Payment failed:", err);
      alert("Payment failed: " + (err.response?.data?.error || err.message));
    }
  };

  // useEffect for battery monitor with fix
  // useEffect(() => {
  //   if (!navigator.getBattery) {
  //     console.warn("Battery API not supported");
  //     return;
  //   }

  //   let batteryObj = null;
  //   let interval = null;

  //   const initBattery = async () => {
  //     try {
  //       batteryObj = await navigator.getBattery();
  //       setBattery({ level: batteryObj.level, charging: batteryObj.charging });

  //       interval = setInterval(() => {
  //         try {
  //           const currentPct = Number((batteryObj.level * 100).toFixed(2));
  //           const isCharging = batteryObj.charging;

  //           setBattery({ level: batteryObj.level, charging: isCharging });

  //           // When charging starts, reset processing flag
  //           if (isCharging && !chargingSession) {
  //             setChargingSession({ startPct: currentPct, startTime: new Date() });
  //             setPendingCharge(null);
  //             chargingProcessedRef.current = false; // reset trigger
  //           }

  //           // When charging stops, trigger payment once
  //           if (!isCharging && chargingSession && !chargingProcessedRef.current) {
  //             const endPct = currentPct;
  //             const chargedPercent = Number((endPct - chargingSession.startPct).toFixed(2));

  //             if (chargedPercent > 0.1) {
  //               const energyUsed = Number(((car.capacityKWh * chargedPercent) / 100).toFixed(2));
  //               const rangeAdded = Number(((car.rangeKm * chargedPercent) / 100).toFixed(1));
  //               const durationMs = new Date() - chargingSession.startTime;
  //               const durationMinutes = Number((durationMs / 60000).toFixed(1));
  //               const cost = Number((energyUsed * unitCostPerKWh).toFixed(2));

  //               const chargeData = {
  //                 start: chargingSession.startPct,
  //                 end: endPct,
  //                 chargedPercent,
  //                 energyUsed,
  //                 rangeAdded,
  //                 durationMinutes,
  //                 cost,
  //                 startTime: chargingSession.startTime,
  //                 endTime: new Date(),
  //               };

  //               setPendingCharge(chargeData);
  //               confirmPayment(chargeData);
  //             }
  //             // Mark as processed to prevent re-trigger
  //             chargingProcessedRef.current = true;
  //             setChargingSession(null);
  //           }
  //         } catch (innerErr) {
  //           console.error("Battery interval error:", innerErr);
  //         }
  //       }, 1000);
  //     } catch (err) {
  //       console.error("Battery API error:", err);
  //     }
  //   };

  //   initBattery();

  //   return () => {
  //     if (interval) clearInterval(interval);
  //   };
  // }, [chargingSession]);

useEffect(() => {
  if (!navigator.getBattery) {
    console.warn("Battery API not supported");
    return;
  }

  let batteryObj = null;

  const initBattery = async () => {
    try {
      batteryObj = await navigator.getBattery();
      setBattery({ level: batteryObj.level, charging: batteryObj.charging });

      const handleBatteryChange = () => {
        const currentPct = Number((batteryObj.level * 100).toFixed(2));
        const isCharging = batteryObj.charging;

        setBattery({ level: batteryObj.level, charging: isCharging });

      
        if (isCharging && !chargingSession) {
          setChargingSession({ startPct: currentPct, startTime: new Date() });
          chargingProcessedRef.current = false;
        }

        if (!isCharging && chargingSession && !chargingProcessedRef.current) {
          const chargedPercent = 1; // FIXED 1% charge
          const energyUsed = Number(((car.capacityKWh * chargedPercent) / 100).toFixed(2));
          const rangeAdded = Number(((car.rangeKm * chargedPercent) / 100).toFixed(1));
          const durationMs = new Date() - chargingSession.startTime;
          const durationMinutes = Number((durationMs / 60000).toFixed(1));
          const cost = Number((energyUsed * unitCostPerKWh).toFixed(2));

          const chargeData = {
            start: chargingSession.startPct,
            end: chargingSession.startPct + chargedPercent,
            chargedPercent,
            energyUsed,
            rangeAdded,
            durationMinutes,
            cost,
            startTime: chargingSession.startTime,
            endTime: new Date(),
          };

          setPendingCharge(chargeData);
          confirmPayment(chargeData);

          // Mark as processed
          chargingProcessedRef.current = true;
          setChargingSession(null);
        }
      };

      // Listen to battery events
      batteryObj.addEventListener("chargingchange", handleBatteryChange);
      batteryObj.addEventListener("levelchange", handleBatteryChange);

      // Cleanup
      return () => {
        batteryObj.removeEventListener("chargingchange", handleBatteryChange);
        batteryObj.removeEventListener("levelchange", handleBatteryChange);
      };
    } catch (err) {
      console.error("Battery API error:", err);
    }
  };

  initBattery();
}, [chargingSession]);



  // Load data on mount
  useEffect(() => {
    loadUsers();
    loadTransactions();
  }, []);

  // Auto scroll for blockchain
  useEffect(() => {
    if (showBlockchain && scrollContainerRef.current && transactions.length > 0) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [transactions, showBlockchain]);

  // Save theme preference
  useEffect(() => {
    try {
      localStorage.setItem("dashboard_theme", darkMode ? "dark" : "light");
    } catch {}
  }, [darkMode]);

  // Copy to clipboard utility
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard");
    } catch {
      alert("Copy failed");
    }
  };

  // Verify block (mock)
  const verifyBlock = (tx) => {
    alert("Transaction verified (mock).");
  };

  // Calculate analytics
  const analytics = React.useMemo(() => {
    const totalSpent = transactions.reduce(
      (s, t) => s + Number(t.amount_local ?? t.manual_amount ?? 0),
      0
    );
    const totalEnergy = transactions.reduce(
      (s, t) => s + Number(t.energy_kwh ?? 0),
      0
    );
    const highest = transactions.reduce(
      (mx, t) => Math.max(mx, Number(t.amount_local ?? t.manual_amount ?? 0)),
      0
    );
    const avg = transactions.length ? totalSpent / transactions.length : 0;
    return {
      totalSpent,
      totalEnergy,
      highest,
      avg,
      count: transactions.length,
    };
  }, [transactions]);

  const currentRange = (battery.level * car.rangeKm).toFixed(1);
  const remainingPercent = Number((100 - battery.level * 100).toFixed(1));
  const estimatedTimeToFullHours = Number(((remainingPercent / 100) * car.chargeTimeHours).toFixed(2));

  
  const renderCharts = () => (
    <div className="section-card" style={{ marginTop: 12 }}>
      <h4><FaChartBar /> Basic Wallet Analytics</h4>
      <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
        <div style={{ minWidth: 160 }}>
          <small className="small-muted">Total Spent</small>
          <div style={{ fontWeight: 700 }}>{`ETH ${analytics.totalSpent.toFixed(2)}`}</div>
        </div>
        <div style={{ minWidth: 160 }}>
          <small className="small-muted">Energy Used</small>
          <div style={{ fontWeight: 700 }}>{`${analytics.totalEnergy.toFixed(2)} kWh`}</div>
        </div>
        <div style={{ minWidth: 160 }}>
          <small className="small-muted">Sessions</small>
          <div style={{ fontWeight: 700 }}>{analytics.count}</div>
        </div>
      </div>
    </div>
  );

 
  const renderHeatmap = () => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const rows = 6;
    return (
      <div className="section-card" style={{ marginTop: 12 }}>
        <h4>Charging Heatmap</h4>
        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, marginTop: 8 }}>
          <div style={{ fontSize: 13, color: "#666" }}>Hour/Day</div>
          <div style={{ display: "flex", gap: 6 }}>
            {days.map((d) => (
              <div key={d} style={{ flex: 1, textAlign: "center", fontSize: 13, color: "#333" }}>
                {d}
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          {Array.from({ length: rows }).map((_, r) => (
            <div
              key={r}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 1fr",
                gap: 8,
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <div style={{ color: "#666", fontSize: 13 }}>{`${r * 4}:00`}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {days.map((d, i) => {
                  const v = Math.floor(Math.random() * 6);
                  const bg = v === 0 ? "#eee" : `rgba(0,122,255, ${0.08 * v + 0.05})`;
                  return (
                    <div
                      key={d + i}
                      style={{ flex: 1, height: 28, background: bg, borderRadius: 6 }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

 
  return (
    <>
      <style jsx>{`
        :root {
          --bg: ${darkMode ? "#081022" : "#f8f9fa"};
          --card: ${darkMode ? "#0f1724" : "#ffffff"};
          --muted: ${darkMode ? "#9aa7bf" : "#666"};
          --accent: #007aff;
          --success: #28a745;
          --danger: #dc3545;
          --glass: rgba(255,255,255,0.04);
        }

        .dashboard-container {
          padding: 20px;
          font-family: "Segoe UI", Arial, sans-serif;
          background: var(--bg);
          color: ${darkMode ? "#e6eef8" : "#111"};
          min-height: 100vh;
          transition: background 0.2s, color 0.2s;
        }

        .section-card {
          background: var(--card);
          border-radius: 16px;
          padding: 20px;
          margin-top: 20px;
          box-shadow: ${darkMode ? "0 6px 22px rgba(0,0,0,0.6)" : "0 4px 12px rgba(0,0,0,0.08)"};
        }

        .battery-card {
          background: ${battery.charging ? (darkMode ? "#072214" : "#d4edda") : (darkMode ? "#2a0f0f" : "#f8d7da")};
          border-left: 5px solid ${battery.charging ? "var(--success)" : "var(--danger)"};
        }

        .small-muted { color: var(--muted); font-size: 13px; }

        .blockchain-slider {
          overflow-x: auto;
          white-space: nowrap;
          padding: 16px 0;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          margin-top: 12px;
        }

        .blockchain-slider::-webkit-scrollbar { height: 8px; }
        .blockchain-slider::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 8px; }

        .block-card {
          display: inline-block;
          width: 280px;
          background: var(--card);
          border-radius: 14px;
          box-shadow: ${darkMode ? "0 8px 24px rgba(0,0,0,0.6)" : "0 6px 16px rgba(0,0,0,0.1)"};
          padding: 18px;
          margin-right: 16px;
          scroll-snap-align: start;
          position: relative;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          cursor: pointer;
        }
        .block-card:hover { transform: translateY(-6px); }
        .block-header { background: var(--accent); color: white; padding: 8px 12px; border-radius: 10px; font-weight: 600; font-size: 14px; text-align: center; margin-bottom: 12px; }
        .block-preview { font-size: 15px; margin: 6px 0; }
        .block-time { font-size: 13px; color: var(--muted); margin-top: 4px; }

        .info-box {
          display: none;
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: var(--card);
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 12px;
          padding: 14px 18px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.18);
          min-width: 260px;
          z-index: 100;
          margin-top: 10px;
          font-size: 13.5px;
          line-height: 1.5;
        }
        .info-box p { margin: 6px 0; color: ${darkMode ? "#cfe7ff" : "#222"}; }

        .btn-primary { background: var(--accent); color: white; border: none; padding: 10px 16px; border-radius: 10px; font-weight: 500; cursor: pointer; transition: background 0.18s; }
        .btn-primary:hover { background: #0056b3; }
        .btn-danger { background: var(--danger); color: white; border: none; padding: 10px 16px; border-radius: 10px; cursor: pointer; }

        .input-amount { padding: 10px; border: 1px solid #ced4da; border-radius: 8px; width: 140px; font-size: 15px; }
        .flex-row { display: flex; align-items: center; gap: 12px; }

        @media (max-width: 700px) {
          .block-card { width: 240px; }
          .section-card { padding: 12px; }
        }
      `}</style>

      <div className="dashboard-container">
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#1E90FF", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}>
              Welcome, <span style={{ textTransform: "uppercase", color: "#FF4500" }}>{user.name}</span>
            </h2>
            <p style={{ margin: "6px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              Address:
              <code>{showAddress ? user.address : "••••••••••••••••••••••"}</code>
              <span
                onClick={() => setShowAddress(!showAddress)}
                style={{
                  cursor: "pointer",
                  fontSize: "18px",
                  userSelect: "none",
                }}
              >
                {showAddress ? "👁️‍🗨️" : "🙈"}
              </span>
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn-primary" onClick={() => setShowCharts((s) => !s)}>
              <FaChartBar /> {showCharts ? "Hide Charts" : "Show Charts"}
            </button>

            <button className="btn-primary" onClick={() => setShowHeatmap((s) => !s)}>
              <FaThermometerHalf /> {showHeatmap ? "Hide Heatmap" : "Show Heatmap"}
            </button>

            <button
              className="btn-primary"
              onClick={() => {
                setDarkMode((d) => !d);
              }}
              title="Toggle theme"
            >
              {darkMode ? <><FaSun /> Light</> : <><FaMoon /> Dark</>}
            </button>

            <button className="btn-primary" onClick={() => loadTransactions()}>
              <FaCloudDownloadAlt /> Refresh Tx
            </button>

            <button className="btn-danger" onClick={() => setUser(null)}>
              Logout
            </button>
          </div>
        </div>

       
        <p className="small-muted">
          Balance: <strong>ETH {users[user.id]?.balance?.toFixed(2) ?? "0.00"}</strong>
        </p>

       
        <div className="section-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "12px",
                backgroundImage:
                  "url('https://png.pngtree.com/thumb_back/fh260/background/20230707/pngtree-green-background-with-electric-car-charging-battery-3d-rendered-power-source-image_3818491.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                color: "white",
                boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
              }}
            >
              <h3
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontWeight: "700",
                  color: "rgba(155, 169, 8, 1)",
                }}
              >
                <FaCarSide /> {car.name}
              </h3>
              <p style={{ margin: "6px 0" }}>Battery Capacity: {car.capacityKWh} kWh</p>
              <p style={{ margin: "6px 0" }}>Full Range: {car.rangeKm} km</p>
              <p style={{ margin: "6px 0" }}>Full Charge: {car.chargeTimeHours} hrs</p>
              <p style={{ margin: "6px 0" }}>Fast Charge: {car.fastChargeMinutes} min (to 80%)</p>
            </div>

            {/* Quick Analytics */}
            <div style={{ width: 320, minWidth: 220 }}>
              <div className="section-card" style={{ padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>Quick Analytics</h4>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <p className="small-muted" style={{ margin: 0 }}>Range</p>
                    <h3 style={{ margin: 0 }}>{currentRange} km</h3>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="small-muted" style={{ margin: 0 }}>Sessions</p>
                    <h3 style={{ margin: 0 }}>{analytics.count}</h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Battery info */}
        <div className={`section-card battery-card`} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 180, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{(battery.level * 100).toFixed(1)}%</div>
            <div style={{ marginTop: 6 }} className="small-muted">{battery.charging ? <><FaPlug /> Charging...</> : "Disconnected"}</div>
            <div style={{ marginTop: 8, height: 12, background: "#e9ecef", borderRadius: 12, overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, battery.level * 100))}%`,
                  height: "100%",
                  transition: "width 0.8s ease",
                  background: battery.charging ? "linear-gradient(90deg,#28a745,#7be495)" : "linear-gradient(90deg,#dc3545,#f59a9a)",
                }}
              />
            </div>
          </div>

          {/* Battery health & prediction */}
          <div style={{ flex: 1 }}>
            <h4 style={{ marginTop: 0 }}>Battery Health & Prediction</h4>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p className="small-muted">Health Score</p>
                <h3>95%</h3>
              </div>
              <div style={{ flex: 1 }}>
                <p className="small-muted">Est. Time to Full</p>
                <h3>{estimatedTimeToFullHours} hrs</h3>
              </div>
              <div style={{ flex: 1 }}>
                <p className="small-muted">Range Left</p>
                <h3>{currentRange} km</h3>
              </div>
            </div>
          </div>
        </div>

       
        {pendingCharge && !chargingSession && (
          <div className="section-card" style={{ backgroundColor: darkMode ? "#13202a" : "#fff8dc" }}>
            <h3><FaMoneyBillWave /> Last Charge (Auto-Paid)</h3>
            <p>From: <strong>{pendingCharge.start.toFixed(1)}%</strong> → <strong>{pendingCharge.end.toFixed(1)}%</strong></p>
            <p>Charged: <strong>{pendingCharge.chargedPercent.toFixed(1)}%</strong></p>
            <p>Energy: <strong>{pendingCharge.energyUsed} kWh</strong></p>
            <p>Range Added: <strong>+{pendingCharge.rangeAdded} km</strong></p>
            <p>Duration: <strong>{pendingCharge.durationMinutes} min</strong></p>
            <p>Cost: <strong style={{ color: "var(--success)" }}>ETH {pendingCharge.cost.toFixed(2)}</strong></p>
          </div>
        )}

       
        <div className="section-card">
          <h3><FaMoneyBillWave /> Manual Payment</h3>
          <div className="flex-row">
            <input
              type="number"
              placeholder="Amount (ETH)"
              value={manualPayAmount}
              onChange={(e) => setManualPayAmount(e.target.value)}
              className="input-amount"
            />
            <button onClick={handleManualPay} className="btn-primary">Pay Now</button>

            {/* Show total spent and energy used */}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <small className="small-muted">Total Spent</small>
                <strong>ETH {analytics.totalSpent.toFixed(2)}</strong>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <small className="small-muted">Energy Used</small>
                <strong>{analytics.totalEnergy.toFixed(2)} kWh</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Optional Charts & Heatmap */}
        {showCharts && renderCharts()}
        {showHeatmap && renderHeatmap()}

        {/* Blockchain Transactions */}
        <div style={{ marginTop: 30 }}>
          <button onClick={() => setShowBlockchain((s) => !s)} className="btn-primary">
            {showBlockchain ? "Hide Transaction" : "Show Transaction"}
          </button>

          {showBlockchain && (
            <div style={{ marginTop: 16 }}>
              <h3>Blockchain Transactions</h3>
              <div ref={scrollContainerRef} className="blockchain-slider">
                {transactions.length === 0 ? (
                  <p style={{ padding: "0 16px", color: "#666" }}>No transactions yet.</p>
                ) : (
                  // Keep order: Block 1 = oldest
                  transactions.map((tx, i) => {
                    const displayIdx = i + 1;
                    const energy = tx.energy_kwh ?? tx.manual_amount ?? 0;
                    const amount = tx.amount_local ?? tx.manual_amount ?? 0;
                    const ts = tx.timestamp ? new Date(tx.timestamp) : new Date();

                    return (
                      <div
                        key={tx.id ?? i}
                        className="block-card"
                        onClick={(e) => {
                          const info = e.currentTarget.querySelector(".info-box");
                          const visible = info.style.display === "block";
                          document.querySelectorAll(".info-box").forEach((el) => (el.style.display = "none"));
                          info.style.display = visible ? "none" : "block";
                        }}
                      >
                        <div className="block-header">Transactions {displayIdx}</div>
                        <div className="block-preview">
                          <strong>ETH {Number(amount).toFixed(2)}</strong> • {Number(energy).toFixed(2)} kWh
                        </div>
                        <div className="block-time">{ts.toLocaleString()}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button
                            className="btn-primary"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              verifyBlock(tx);
                            }}
                          >
                            <FaCheckCircle /> Verify
                          </button>
                          <button
                            className="btn-primary"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              copyToClipboard(JSON.stringify(tx));
                            }}
                          >
                            <FaCopy /> Copy
                          </button>
                        </div>
                        <div className="info-box">
                          <p>
                            <strong>From:</strong> {tx.from_address || tx.from_user || "N/A"}
                          </p>
                          <p>
                            <strong>To:</strong> {tx.to_address || tx.to_user || "N/A"}
                          </p>
                          <p>
                            <strong>Energy:</strong> {Number(energy).toFixed(2)} kWh
                          </p>
                          <p>
                            <strong>Amount:</strong> ETH {Number(amount).toFixed(2)}
                          </p>
                          <p>
                            <strong>Time:</strong> {ts.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Map component */}
        <Map />

        {/* Footer buttons */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-primary"
              onClick={() => {
                alert("Nearby stations demo - UI only.");
              }}
            >
              Show Nearby Stations
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                alert("Suggest cheapest time demo - UI only.");
              }}
            >
              Suggest Cheapest Time
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <small className="small-muted">UI Mode:</small>
            <button className="btn-primary" onClick={() => setDarkMode((d) => !d)}>
              {darkMode ? "Light" : "Dark"}
            </button>
            <button className="btn-primary" onClick={() => loadTransactions()}>
              Refresh
            </button>
          </div>
        </div>
        <Graph />
      </div>
    </>
  );
}

export default Dashboard;