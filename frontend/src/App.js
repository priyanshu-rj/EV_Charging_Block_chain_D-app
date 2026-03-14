import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Owner from "./components/Owner";

function App() {
  const [user, setUser] = useState(null);

  return (
    <Router>
      <Routes>

      
        <Route path="/" element={
          !user ? (
            <Login setUser={setUser} />
          ) : (
            <Dashboard user={user} setUser={setUser} />
          )
        } />

   
        <Route path="/owner" element={<Owner />} />

      </Routes>
    </Router>
  );
}

export default App;
