// รวมฟังก์ชันแผนที่ MRT พร้อมจุดเริ่มต้น/ปลายทาง โหมดเดินทาง และ Grid Line

const stationCoords = {
  phahonyothin: [13.88, 100.6],
  sukhumvit: [13.74, 100.56],
  bang_sue: [13.80, 100.54],
  chatuchak: [13.8, 100.55],
  ladprao: [13.79, 100.6],
  ratchadaphisek: [13.80, 100.57],
  "บางซื่อ": [13.80, 100.54],
  "สุขุมวิท": [13.74, 100.56],
  "หัวลำโพง": [13.74, 100.52],
  "พระราม 9": [13.76, 100.57],
  "พหลโยธิน": [13.88, 100.6],
  "สวนจตุจักร": [13.8, 100.55],
  "ลาดพร้าว": [13.79, 100.6],
  "รัชดาภิเษก": [13.80, 100.57]
};

const map = L.map("map", {
  zoomControl: false
}).setView([13.7563, 100.5018], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// ปรับขนาดแผนที่ให้ responsive สำหรับมือถือ
function resizeMap() {
  const mapContainer = document.getElementById("map");
  const height = window.innerWidth < 768 ? window.innerHeight * 0.6 : 500;
  mapContainer.style.height = `${height}px`;
  map.invalidateSize();
}
window.addEventListener("resize", resizeMap);
window.addEventListener("load", resizeMap);

let userCoords = null;
let startMarker = null;
let endMarker = null;
let control = null;
let straightLine = null;

const redIcon = L.icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

const blueIcon = L.icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

for (const [station, coords] of Object.entries(stationCoords)) {
  const marker = L.marker(coords).addTo(map);
  marker.bindPopup(`🚉 สถานี: ${station.replace("_", " ")}`);
}

function addGridLines() {
  const bounds = map.getBounds();
  const latStep = 0.01;
  const lngStep = 0.01;

  for (let lat = bounds.getSouth(); lat <= bounds.getNorth(); lat += latStep) {
    L.polyline([
      [lat, bounds.getWest()],
      [lat, bounds.getEast()],
    ], {
      color: "#ccc",
      weight: 1,
      dashArray: "4,4"
    }).addTo(map);
  }

  for (let lng = bounds.getWest(); lng <= bounds.getEast(); lng += lngStep) {
    L.polyline([
      [bounds.getSouth(), lng],
      [bounds.getNorth(), lng],
    ], {
      color: "#ccc",
      weight: 1,
      dashArray: "4,4"
    }).addTo(map);
  }
}

map.whenReady(addGridLines);


if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      userCoords = [position.coords.latitude, position.coords.longitude];
      const marker = L.marker(userCoords).addTo(map);
      marker.bindPopup("📍 คุณอยู่ที่นี่").openPopup();
      map.setView(userCoords, 15);
      document.getElementById("status").textContent = "✅ ตำแหน่งของคุณพร้อมแล้ว";
    },
    () => {
      document.getElementById("status").textContent = "❌ ไม่สามารถระบุตำแหน่งได้";
    }
  );
} else {
  alert("เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง");
}

const startPointSelect = document.getElementById("startPoint");
const destinationSelect = document.getElementById("destination");
const infoBox = document.getElementById("info");

const defaultStartOptions = ["ตำแหน่งของฉัน", ...Object.keys(stationCoords)];
defaultStartOptions.forEach(name => {
  const opt = document.createElement("option");
  opt.value = name === "ตำแหน่งของฉัน" ? "userLocation" : name;
  opt.textContent = name;
  startPointSelect.appendChild(opt);
});

Object.keys(stationCoords).forEach(name => {
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  destinationSelect.appendChild(opt);
});

function calculateRoute() {
  const startName = startPointSelect.value;
  const destName = destinationSelect.value;
  const travelMode = document.getElementById("travelMode").value;

  if (!destName) return alert("กรุณาเลือกสถานีปลายทาง");

  let startCoords = null;
  if (startName === "userLocation") {
    if (!userCoords) {
      alert("ไม่สามารถระบุตำแหน่งของคุณได้ กรุณาเลือกสถานีเริ่มต้น");
      return;
    }
    startCoords = userCoords;
  } else {
    startCoords = stationCoords[startName];
  }

  const destCoords = stationCoords[destName];
  if (!startCoords || !destCoords) return;

  const from = L.latLng(startCoords);
  const to = L.latLng(destCoords);

  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);
  if (control) map.removeControl(control);
  if (straightLine) map.removeLayer(straightLine);

  startMarker = L.marker(from, { icon: blueIcon }).addTo(map).bindPopup(`จุดเริ่มต้น: ${startName}`).openPopup();
  endMarker = L.marker(to, { icon: redIcon }).addTo(map).bindPopup(`ปลายทาง: ${destName}`).openPopup();

  // วาดเส้นตรงจากต้นทางถึงปลายทาง
  straightLine = L.polyline([from, to], {
    color: "blue",
    weight: 3,
    dashArray: "4, 6",
    opacity: 0.7
  }).addTo(map);

  if (travelMode === "train") {
    const trainRoutes = {
      "บางซื่อ": ["บางซื่อ → ศูนย์ราชการ → พระราม 9"],
      "สุขุมวิท": ["สุขุมวิท → พระราม 9"],
      "หัวลำโพง": ["หัวลำโพง → บางซื่อ"],
      "ศูนย์ราชการ": ["ศูนย์ราชการ → พระราม 9"],
      "พระราม 9": ["พระราม 9 → สุขุมวิท"]
    };

    if (trainRoutes[destName]) {
      infoBox.innerHTML = `🚈 รายละเอียดการต่อรถไฟ:<br><b>${trainRoutes[destName][0]}</b><br>🕒 ใช้เวลาประมาณ 0 ชม. 5 นาที ถึงสถานี <b>${destName}</b>`;
      map.setView(to, 14);
    } else {
      infoBox.innerHTML = `❌ ไม่สามารถต่อรถไฟไปยังสถานี <b>${destName}</b> ได้`;
    }
    return;
  }

  control = L.Routing.control({
    waypoints: [from, to],
    lineOptions: { styles: [{ color: travelMode === 'car' ? 'blue' : 'green', weight: 5 }] },
    createMarker: () => null,
    router: L.Routing.osrmv1({
      serviceUrl: 'https://router.project-osrm.org/route/v1'
    }),
    routeWhileDragging: false,
    fitSelectedRoutes: true,
    showAlternatives: false,
    profile: travelMode === 'car' ? 'car' : 'foot'
  }).addTo(map);

  infoBox.innerHTML = `🔍 กำลังคำนวณเส้นทาง...`;
}

document.getElementById("btnRoute").addEventListener("click", calculateRoute);