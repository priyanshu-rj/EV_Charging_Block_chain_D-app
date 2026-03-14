// Map.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvent,
  useMap,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "leaflet-routing-machine";

// --- Icons ---
const userIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/1946/1946429.png",
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

const carIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/61/61205.png",
  iconSize: [44, 44],
  iconAnchor: [22, 44],
});

const destIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});


function createPulseIcon(baseIconUrl, size = 36) {
  const el = document.createElement("div");
  el.style.position = "relative";
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";

  const pulse = document.createElement("span");
  pulse.className = "user-pulse";
  pulse.style.position = "absolute";
  pulse.style.width = `${size}px`;
  pulse.style.height = `${size}px`;
  pulse.style.borderRadius = "50%";
  pulse.style.transform = "translate(-0%, -0%)";
  pulse.style.zIndex = "0";

  const img = document.createElement("img");
  img.src = baseIconUrl;
  img.style.width = `${Math.floor(size * 0.65)}px`;
  img.style.height = `${Math.floor(size * 0.65)}px`;
  img.style.zIndex = "1";

  el.appendChild(pulse);
  el.appendChild(img);

  return L.divIcon({
    html: el,
    className: "",
    iconSize: [size, size],
    iconAnchor: [Math.floor(size / 2), Math.floor(size / 2)],
  });
}


function ClickHandler({ setDestination }) {
  useMapEvent("click", (e) => {
    setDestination([e.latlng.lat, e.latlng.lng]);
  });
  return null;
}

export default function Map() {
  const [position, setPosition] = useState(null);
  const [carPosition, setCarPosition] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeSummary, setRouteSummary] = useState(null);
  const routingControlRef = useRef(null);
  const routePolylineRef = useRef(null);
  const animationRef = useRef({ timer: null, idx: 0, coords: [] });
  const mapRef = useRef(null);


  useEffect(() => {
    if (!navigator.geolocation) {
      setPosition([28.615, 77.209]);
      setCarPosition([28.615, 77.209]);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setPosition(coords);
        setCarPosition(coords);
      },
      (err) => {
        setPosition([28.615, 77.209]);
        setCarPosition([28.615, 77.209]);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  }, []);


  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routingControlRef.current) {
      try { map.removeControl(routingControlRef.current); } catch {}
      routingControlRef.current = null;
    }
    if (routePolylineRef.current) {
      try { routePolylineRef.current.remove(); } catch {}
      routePolylineRef.current = null;
    }
    if (animationRef.current.timer) {
      clearInterval(animationRef.current.timer);
      animationRef.current.timer = null;
      animationRef.current.idx = 0;
      animationRef.current.coords = [];
    }
    setRouteSummary(null);
    if (!destination || !position) return;

    const control = L.Routing.control({
      waypoints: [L.latLng(position[0], position[1]), L.latLng(destination[0], destination[1])],
      showAlternatives: false,
      addWaypoints: false,
      routeWhileDragging: false,
      draggableWaypoints: false,
      fitSelectedRoute: true,
      lineOptions: { styles: [{ color: "#ff5722", weight: 6, opacity: 0.95 }] },
      createMarker: () => null,
      router: L.Routing.osrmv1({ serviceUrl: "https://router.project-osrm.org/route/v1" }),
      show: false,
    }).addTo(map);

    routingControlRef.current = control;

    control.on("routesfound", (e) => {
      const routes = e.routes;
      if (!routes || routes.length === 0) return;
      const route = routes[0];
      const coords = route.coordinates.map((c) => [c.lat, c.lng]);
      routePolylineRef.current = L.polyline(coords, { color: "#ff5722", weight: 5, opacity: 0.8 }).addTo(map);
      const distKm = route.summary.totalDistance / 1000;
      const timeMin = route.summary.totalTime / 60;
      setRouteSummary({ distanceKm: distKm.toFixed(2), timeMin: timeMin.toFixed(1) });
      animateCarAlong(coords, map);
    });

    control.on("routingerror", (err) => {
      console.warn("Routing error", err);
      alert("Routing failed. Try again.");
    });

    return () => {
      try { map.removeControl(control); } catch {}
      if (routePolylineRef.current) try { routePolylineRef.current.remove(); } catch {}
      if (animationRef.current.timer) clearInterval(animationRef.current.timer);
    };
  }, [destination, position]);

  function animateCarAlong(coords, map) {
    if (!coords || coords.length === 0) return;
    setCarPosition(coords[0]);
    animationRef.current.coords = coords;
    animationRef.current.idx = 0;
    if (animationRef.current.timer) clearInterval(animationRef.current.timer);

    const stepMs = 600;
    animationRef.current.timer = setInterval(() => {
      const idx = animationRef.current.idx;
      const coordsArr = animationRef.current.coords;
      if (idx >= coordsArr.length) {
        clearInterval(animationRef.current.timer);
        animationRef.current.timer = null;
        animationRef.current.idx = 0;
        return;
      }
      setCarPosition(coordsArr[idx]);
      animationRef.current.idx += 1;
    }, stepMs);
  }

  const recenter = (which = "user") => {
    const map = mapRef.current;
    if (!map) return;
    if (which === "user" && position) map.setView(position, 15, { animate: true });
    else if (which === "car" && carPosition) map.setView(carPosition, 16, { animate: true });
    else if (which === "dest" && destination) map.setView(destination, 16, { animate: true });
  };

  function MapWrapper({ children }) {
    const map = useMap();
    useEffect(() => {
      mapRef.current = map;
      setTimeout(() => { try { map.invalidateSize(); } catch {} }, 200);
    }, [map]);
    return children || null;
  }

  const zoom = (dir = "in") => {
    const map = mapRef.current;
    if (!map) return;
    const z = map.getZoom();
    map.setZoom(dir === "in" ? z + 1 : z - 1);
  };
 const [mapTheme, setMapTheme] = useState("light");

  return (
    <div style={styles.card}>
      <style>{`
        .user-pulse {
          animation: pulse 1800ms ease-out infinite;
          opacity: 0.9;
          background: rgba(255, 87, 34, 0.2);
        }
        @keyframes pulse {
          0% { transform: scale(0.6); opacity: 0.9; }
          50% { transform: scale(1.6); opacity: 0.28; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .floating-controls { position: absolute; top: 12px; left: 12px; display:flex; flex-direction:column; gap:8px; z-index:500; }
        .floating-controls button { background: rgba(255,255,255,0.8); color: #222; border: none; padding: 8px 10px; border-radius: 8px; cursor: pointer; font-weight: 600; }
        .info-panel { position: absolute; left: 50%; transform: translateX(-50%); bottom: 14px; z-index: 500; background: rgba(255,255,255,0.9); color: #222; padding: 10px 14px; border-radius: 12px; box-shadow: 0 6px 18px rgba(0,0,0,0.15); }
        .hint { position: absolute; right: 12px; top: 12px; z-index:500; background: rgba(255,255,255,0.9); padding: 6px 10px; border-radius: 8px; color: #222; font-weight: 600; }
      `}</style>

      <h3 style={styles.title}>MAP</h3>
<button
  onClick={() => setMapTheme(mapTheme === "light" ? "dark" : "light")}
  title="Toggle Theme"
  style={{
    background: mapTheme === "light" ? "#1a73e8" : "#222",
    color: "white",
    padding: "8px 16px",
    border: "none",
    borderRadius: "22px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
    marginTop: "10px",
    display: "block",
    marginLeft: "auto",
    marginRight: "auto",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    transition: "all 0.25s ease",
  }}
>
  {mapTheme === "light" ? "Dark Mode" : "Light Mode"}
</button>


      {!position ? (
        <div style={{ padding: 18, textAlign: "center", color: "#555" }}>Getting location…</div>
      ) : (
        <div style={{ position: "relative" }}>
          <div className="floating-controls">
            <button onClick={() => recenter("user")} title="Center on you">Center</button>
            <button onClick={() => zoom("in")} title="Zoom in">+</button>
            <button onClick={() => zoom("out")} title="Zoom out">−</button>
            <button onClick={() => { setDestination(null); setRouteSummary(null); if (routePolylineRef.current) try { routePolylineRef.current.remove(); } catch {} routePolylineRef.current = null; }} title="Clear route">Clear</button>
          </div>

          <div className="hint">Click anywhere on map to set destination → route & animate car</div>

          <MapContainer
            center={position}
            zoom={15}
            style={styles.map}
            scrollWheelZoom={true}
            whenReady={(e) => { setTimeout(() => e.target.invalidateSize(), 200); }}
          >
            <MapWrapper />
         {mapTheme === "light" ? (
  <TileLayer
    url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png"
    attribution="© OpenMapTiles © OpenStreetMap contributors"
  />
) : (
  <TileLayer
    url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png"
    attribution="© OpenMapTiles © OpenStreetMap contributors"
  />
)}




            <ClickHandler setDestination={setDestination} />

            <Marker
              position={position}
              icon={createPulseIcon("https://cdn-icons-png.flaticon.com/512/1946/1946429.png", 44)}
            >
              <Popup>You are here</Popup>
            </Marker>

            {carPosition && (
              <Marker position={carPosition} icon={carIcon}>
                <Popup>Car</Popup>
              </Marker>
            )}

            {destination && (
              <Marker position={destination} icon={destIcon}>
                <Popup>Destination</Popup>
              </Marker>
            )}
          </MapContainer>

          <div className="info-panel">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Route</div>
                <div style={{ fontWeight: 700 }}>{destination ? "To destination" : "No destination set"}</div>
              </div>
              <div style={{ marginLeft: 12 }}>
                {routeSummary ? (
                  <>
                    <div style={{ fontSize: 12 }}>Distance</div>
                    <div style={{ fontWeight: 700 }}>{routeSummary.distanceKm} km</div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Click map to route</div>
                )}
              </div>
              <div style={{ marginLeft: 12 }}>
                {routeSummary ? (
                  <>
                    <div style={{ fontSize: 12 }}>ETA</div>
                    <div style={{ fontWeight: 700 }}>{routeSummary.timeMin} min</div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// styles object
const styles = {
  card: {
    background: "linear-gradient(180deg, #f5f9ff, #e0f0ff)",
    padding: "12px",
    borderRadius: "14px",
    width: "100%",
    maxWidth: "1100px",
    margin: "14px auto",
    boxShadow: "0 6px 30px rgba(0,0,0,0.1)",
    color: "#222",
  },
  title: {
    margin: 0,
    marginBottom: 8,
    fontSize: 18,
    textAlign: "center",
    color: "#1a73e8",
  },
  map: {
    height: "520px",
    width: "100%",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "inset 0 1px 0 rgba(0,0,0,0.05)",
  },
};
