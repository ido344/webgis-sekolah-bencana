// // 1. Menambahkan Elemen Dasar Peta Pada Halaman HTML
// 1.1 Membuat Variabel Peta dan Melakukan Set View Halaman Peta di Lokasi Tertentu
const map = L.map('map', {
    preferCanvas: true // === PERUBAHAN: supaya rendering lebih cepat
});

// === PERUBAHAN: Buat pane untuk Titik Sekolah supaya selalu di atas ===
map.createPane('paneTitikSekolah');
map.getPane('paneTitikSekolah').style.zIndex = 650;
// === Tambahan: Buat pane khusus untuk Batas Admin ===
map.createPane('paneBatasAdmin');
map.getPane('paneBatasAdmin').style.zIndex = 600;
// (lebih kecil dari paneTitikSekolah, tapi lebih besar dari layer bahaya)
// === Akhir tambahan pane Batas Admin ===
map.setView([-6.912296327013825, 107.60995170639679], 9.5);
// 1.2 Menambahkan Basemap OSM
const basemapOSM = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
//basemap gelap
// 1.2 Menambahkan Basemap Esri Dark
const basemapesri = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20,
    attribution: 'Data peta © <a href="https://www.esri.com">Esri</a>'
}).addTo(map);
// 1.3 Menambahkan Basemap OSM HOT
const osmHOT = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team hosted by OpenStreetMap France'
});
// 1.4 Menambahkan Basemap Google
const baseMapGoogle = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: 'Map by <a href="https://maps.google.com/">Google</a>',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});
// 1.5 Menambahkan Fitur Fullscreen Peta
map.addControl(new L.Control.Fullscreen());
// 1.6 Menambahkan Tombol Home (Zoom to Extent)
const home = {
    lat: -6.912296327013825,
    lng: 107.60995170639679,
    zoom: 10
};
L.easyButton('fas fa-home', function (btn, map) {
    map.setView([home.lat, home.lng], home.zoom);
}, 'Zoom To Home').addTo(map)
// 1.7 Menambahkan Fitur My Location
map.addControl(
    L.control.locate({
        locateOptions: {
            enableHighAccuracy: true
        }
    })
);

///Data Spasial
function getSekolahStyle(Klasifikasi) {
    let warna;
    switch (Klasifikasi) {
        case "SMA":
            warna = "#1f77b4"; // Biru
            break;
        case "MA":
            warna = "rgb(42, 97, 28)"; // Hijau
            break;
        case "SMK":
            warna = "rgb(255, 115, 0)"; // Oranye
            break;
        default:
            warna = "#999999"; // Abu-abu untuk 'Lainnya'
    }

    return {
        radius: 6,
        fillColor: warna,
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    };
}


// Layer grup sekolah & bahaya Bencana
const TitikSekolah = new L.LayerGroup();
const BahayaGempa = new L.LayerGroup();
const BahayaBanjir = new L.LayerGroup();
const BahayaLongsor = new L.LayerGroup();
const BahayaCuacaEkstrem = new L.LayerGroup();
const BatasAdmin = new L.LayerGroup();

// Simpan data poligon gempa buat spatial join nanti
let dataBahayaGempaPolygons = null;
let dataBahayaBanjirPolygons = null;
let dataBahayaLongsorPolygons = null;
let dataBahayaCuacaEkstremPolygons = null;

//style umum bahaya bencana
function styleBahaya(feature) {
    switch (feature.properties.Klasifikas) {
        case 'Rendah': return { fillColor: "#1CFF00", fillOpacity: 0.7, weight: 0.5, color: "#9F8705" };
        case 'Sedang': return { fillColor: "#FFFF00", fillOpacity: 0.7, weight: 0.5, color: "#2C7B22" };
        case 'Tinggi': return { fillColor: "#FF0000", fillOpacity: 0.7, weight: 0.5, color: "#9D1B1B" };
    }
}

// Load data sekolah dan tampilkan popup gabungan
$.getJSON("./asset/SLTAWGS.geojson", function (dataSekolah) {
    L.geoJSON(dataSekolah, {
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                ...getSekolahStyle(feature.properties.Klasifikasi),
                pane: 'paneTitikSekolah' // === tambahkan pane di sini
            });
        },
        onEachFeature: function (feature, layer) {
            layer.on("click", function (e) {
                let namaSekolah = feature.properties.poi_name || "Nama tidak tersedia";
                let klasifikasiGempa = "Di Luar Zona Bahaya";
                let klasifikasiLongsor = "Di Luar Zona Bahaya";
                let klasifikasiBanjir = "Di Luar Zona Bahaya";
                let klasifikasiCuacaEkstrem = "Di Luar Zona Bahaya";

                let latlng = layer.getLatLng();

                if (dataBahayaGempaPolygons) {
                    let result = leafletPip.pointInLayer([latlng.lng, latlng.lat], L.geoJSON(dataBahayaGempaPolygons));
                    if (result.length > 0) klasifikasiGempa = result[0].feature.properties.Klasifikas;
                }

                if (dataBahayaLongsorPolygons) {
                    let result = leafletPip.pointInLayer([latlng.lng, latlng.lat], L.geoJSON(dataBahayaLongsorPolygons));
                    if (result.length > 0) klasifikasiLongsor = result[0].feature.properties.Klasifikas;
                }

                if (dataBahayaBanjirPolygons) {
                    let result = leafletPip.pointInLayer([latlng.lng, latlng.lat], L.geoJSON(dataBahayaBanjirPolygons));
                    if (result.length > 0) klasifikasiBanjir = result[0].feature.properties.Klasifikas;
                }

                if (dataBahayaCuacaEkstremPolygons) {
                    let result = leafletPip.pointInLayer([latlng.lng, latlng.lat], L.geoJSON(dataBahayaCuacaEkstremPolygons));
                    if (result.length > 0) klasifikasiCuacaEkstrem = result[0].feature.properties.Klasifikas;
                }

                let popupContent = `
                    <b>Nama Sekolah:</b> ${namaSekolah}<br>
                    <b>Bahaya Gempa:</b> ${klasifikasiGempa}<br>
                    <b>Bahaya Longsor:</b> ${klasifikasiLongsor}<br>
                    <b>Bahaya Banjir:</b> ${klasifikasiBanjir}<br>
                    <b>Bahaya Cuaca Ekstrem:</b> ${klasifikasiCuacaEkstrem}
                `;

                layer.bindPopup(popupContent).openPopup();
            });
        }
    }).addTo(TitikSekolah);
    TitikSekolah;

});

// Load data bahaya gempa
$.getJSON("./asset/Bahaya_GempaWGS.geojson", function (dataGempa) {
    dataBahayaGempaPolygons = dataGempa; // simpan untuk join nanti

    L.geoJSON(dataGempa, {
        style: styleBahaya,
        onEachFeature: function (feature, layer) {
            layer.bindPopup('<b>Bahaya Gempa:</b> ' + feature.properties.Klasifikas);
        }
    }).addTo(BahayaGempa);
});

// Load data Bahaya Longsor
$.getJSON("./asset/Bahaya LongsorWGS.geojson", function (dataLongsor) {
    dataBahayaLongsorPolygons = dataLongsor;

    L.geoJSON(dataLongsor, {
        style: styleBahaya,
        onEachFeature: function (feature, layer) {
            layer.bindPopup('<b>Bahaya Longsor:</b> ' + feature.properties.Klasifikas);
        }
    }).addTo(BahayaLongsor);
});

// Load data Bahaya Banjir
$.getJSON("./asset/Bahaya BanjirWGS.geojson", function (dataBanjir) {
    dataBahayaBanjirPolygons = dataBanjir;

    L.geoJSON(dataBanjir, {
        style: styleBahaya,
        onEachFeature: function (feature, layer) {
            layer.bindPopup('<b>Bahaya Banjir:</b> ' + feature.properties.Klasifikas);
        }
    }).addTo(BahayaBanjir);
});

// Load data Bahaya Cuaca Ekstrem
$.getJSON("./asset/Bahaya Cuaca EkstremWGS.geojson", function (dataCuacaEkstrem) {
    dataBahayaCuacaEkstremPolygons = dataCuacaEkstrem;
    L.geoJSON(dataCuacaEkstrem, {
        style: styleBahaya,
        onEachFeature: function (feature, layer) {
            layer.bindPopup('<b>Bahaya Cuaca Ekstrem:</b> ' + feature.properties.Klasifikas);
        }
    }).addTo(BahayaCuacaEkstrem);
});

//Load Batas Admin
$.getJSON("./asset/Adm Bandung Raya.geojson", function (OBJECTID) {
    L.geoJSON(OBJECTID, {
        pane: 'paneBatasAdmin', // === PERUBAHAN: masukin ke pane batas admin
        style: {
            color: "black",
            weight: 2,
            opacity: 1,
            fillColor: "rgba(0, 0, 0, 0)",
            fillOpacity: 0 // === fix typo fillopacity ➔ fillOpacity
        }
    }).addTo(BatasAdmin);
});

// === Urutan Layer Manual ===

// 1. Layer bahaya dulu (paling bawah)
BahayaGempa.addTo(map);
BahayaLongsor.addTo(map);
BahayaBanjir.addTo(map);
BahayaCuacaEkstrem.addTo(map);

// 2. Batas Administrasi di atas bahaya
BatasAdmin.addTo(map);

// 3. Titik Sekolah paling atas
TitikSekolah.addTo(map);

// === Akhir Urutan ===


// Layer control
const baseMaps = {
    "Openstreetmap": basemapOSM,
    "OSM HOT": osmHOT,
    "Google": baseMapGoogle,
    "Esri Dark": basemapesri
};

const overlayMaps = {
    "Lokasi Sekolah": TitikSekolah,
    "Bahaya Gempa Bumi": BahayaGempa,
    "Bahaya Longsor": BahayaLongsor, // Tambahan
    "Bahaya Banjir": BahayaBanjir, // Tambahan
    "Bahaya Cuaca Ekstrem": BahayaCuacaEkstrem,// Tambahan
    "Batas Administrasi Kab/Kota": BatasAdmin
};

L.control.layers(baseMaps, overlayMaps).addTo(map);

///Legenda
let legend = L.control({ position: "topright" });
legend.onAdd = function () {
    let div = L.DomUtil.create("div", "legend");
    div.innerHTML =
        //Judul
        '<p style= "font-size: 18px; font-weight: bold; margin-bottom: 5px; margin-top: 10px">Legenda</p>' +
        ///Isi Legenda
        ///Legenda Titik Sekolah
        '<p style= "font-size: 12px; font-weight: bold; margin-bottom: 5px; margin-top: 10px">Sekolah</p>' +
        '<div style="background-color: #1f77b4; width: 15px; height: 15px; border-radius: 50%; float: left; margin-right: 5px;"></div><span>SMA</span><br>' +
        '<div style="background-color: rgb(42, 97, 28); width: 15px; height: 15px; border-radius: 50%; float: left; margin-right: 5px;"></div><span>MA</span><br>' +
        '<div style="background-color:rgb(255, 115, 0); width: 15px; height: 15px; border-radius: 50%; float: left; margin-right: 5px;"></div><span>SMK</span><br>' +
        '<div style="background-color: #999999; width: 15px; height: 15px; border-radius: 50%; float: left; margin-right: 5px;"></div><span>Lainnya</span><br>' +
        ////Legenda Bahaya Bencana
        '<p style= "font-size: 12px; font-weight: bold; margin-bottom: 5px; margin-top: 10px">Klasifikasi Bahaya Bencana</p>' +
        '<div style="background-color: #FF0000"></div>Tinggi<br>' +
        '<div style="background-color: #FFFF00"></div>Sedang<br>' +
        '<div style="background-color: #1CFF00"></div>Rendah<br>'
    return div;
};
legend.addTo(map)

///Search Kontrol
const searchControl = new L.Control.Search({
    layer: TitikSekolah,
    propertyName: 'poi_name',
    position: 'topleft',
    textPlaceholder: 'Cari Sekolah...',
    moveToLocation: function (latlng, title, map) {
        map.setView(latlng, 18); // Zoom pas search
    }
});

map.addControl(searchControl);

// === Tambahan supaya setelah ketemu, langsung buka popup lengkap ===
searchControl.on('search:locationfound', function (e) {
    let feature = e.layer.feature; // Ambil data GeoJSONnya
    let latlng = e.layer.getLatLng();

    // Isi default
    let namaSekolah = feature.properties.poi_name || "Nama tidak tersedia";
    let klasifikasiGempa = "Di Luar Zona Bahaya";
    let klasifikasiLongsor = "Di Luar Zona Bahaya";
    let klasifikasiBanjir = "Di Luar Zona Bahaya";
    let klasifikasiCuacaEkstrem = "Di Luar Zona Bahaya";

    // Cek satu-satu layer bahaya
    if (dataBahayaGempaPolygons) {
        let result = leafletPip.pointInLayer([latlng.lng, latlng.lat], L.geoJSON(dataBahayaGempaPolygons));
        if (result.length > 0) klasifikasiGempa = result[0].feature.properties.Klasifikas;
    }
    if (dataBahayaLongsorPolygons) {
        let result = leafletPip.pointInLayer([latlng.lng, latlng.lat], L.geoJSON(dataBahayaLongsorPolygons));
        if (result.length > 0) klasifikasiLongsor = result[0].feature.properties.Klasifikas;
    }
    if (dataBahayaBanjirPolygons) {
        let result = leafletPip.pointInLayer([latlng.lng, latlng.lat], L.geoJSON(dataBahayaBanjirPolygons));
        if (result.length > 0) klasifikasiBanjir = result[0].feature.properties.Klasifikas;
    }
    if (dataBahayaCuacaEkstremPolygons) {
        let result = leafletPip.pointInLayer([latlng.lng, latlng.lat], L.geoJSON(dataBahayaCuacaEkstremPolygons));
        if (result.length > 0) klasifikasiCuacaEkstrem = result[0].feature.properties.Klasifikas;
    }

    // Buat isi popup
    let popupContent = `
        <b>Nama Sekolah:</b> ${namaSekolah}<br>
        <b>Bahaya Gempa:</b> ${klasifikasiGempa}<br>
        <b>Bahaya Longsor:</b> ${klasifikasiLongsor}<br>
        <b>Bahaya Banjir:</b> ${klasifikasiBanjir}<br>
        <b>Bahaya Cuaca Ekstrem:</b> ${klasifikasiCuacaEkstrem}
    `;

    // Buka popup
    e.layer.bindPopup(popupContent).openPopup();
});
/// === Bagian Infografis Dinamis ===
const filterSelect = document.getElementById("filterJenis");
const infografisTableBody = document.querySelector("#tabelInfografis tbody");

// Dropdown sekolah
const namaSekolahSelect = document.createElement("select");
namaSekolahSelect.id = "namaSekolahSelect";
namaSekolahSelect.innerHTML = "<option value=''>Pilih Sekolah</option>";
namaSekolahSelect.style.marginLeft = "10px";
filterSelect.insertAdjacentElement("afterend", namaSekolahSelect);

let allSekolahFeatures = [];

function updateNamaSekolahDropdown(filteredFeatures) {
    namaSekolahSelect.innerHTML = `
        <option value=''>Pilih Sekolah</option>
        <option value='__ALL__'>Semua Sekolah</option>
    `;
    filteredFeatures.forEach((feature) => {
        const nama = feature.properties.poi_name || "(Tidak Ada Nama)";
        const option = document.createElement("option");
        option.value = nama;
        option.text = nama;
        namaSekolahSelect.appendChild(option);
    });
}
function overlaySekolah(feature) {
    let latlng = L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
    const bahayaTypes = [
        { label: "Gempa", data: dataBahayaGempaPolygons },
        { label: "Longsor", data: dataBahayaLongsorPolygons },
        { label: "Banjir", data: dataBahayaBanjirPolygons },
        { label: "Cuaca Ekstrem", data: dataBahayaCuacaEkstremPolygons },
    ];

    let results = [];
    bahayaTypes.forEach((b) => {
        let klasifikasiBahaya = "Di Luar Zona Bahaya";
        if (b.data) {
            let result = leafletPip.pointInLayer([latlng.lng, latlng.lat], L.geoJSON(b.data));
            if (result.length > 0) klasifikasiBahaya = result[0].feature.properties.Klasifikas;
        }
        if (klasifikasiBahaya !== "Di Luar Zona Bahaya") {
            results.push({ nama: feature.properties.poi_name, jenis: b.label, tingkat: klasifikasiBahaya });
        }
    });
    return results;
}

function renderTabel(data, disableChart = false) {
    infografisTableBody.innerHTML = "";
    data.forEach(row => {
        infografisTableBody.innerHTML += `
            <tr>
                <td>${row.nama}</td>
                <td>${row.jenis}</td>
                <td>${row.tingkat}</td>
            </tr>`;
    });

    if (!disableChart) {
        renderChart(data);
    } else {
        if (window.chartInstance) {
            window.chartInstance.destroy();
        }
    }
}
function renderChart(data) {
    const ctx = document.getElementById("chartInfografis").getContext("2d");
    if (window.chartInstance) window.chartInstance.destroy();

    const levelOrder = ["Di Luar Zona Bahaya", "Rendah", "Sedang", "Tinggi"];
    const warnaBahaya = {
        "Tinggi": "#FF0000",     // Merah
        "Sedang": "#FFFF00",     // Kuning
        "Rendah": "#1CFF00",     // Hijau
        "Di Luar Zona Bahaya": "#CCCCCC" // Abu-abu
    };

    // Urutan tetap jenis bahaya
    const jenisBahayaTetap = ["Gempa", "Cuaca Ekstrem", "Longsor", "Banjir"];

    // Siapkan objek default
    const hasil = jenisBahayaTetap.map(jenis => {
        let entri = data.find(d => d.jenis === jenis);
        let tingkat = entri ? entri.tingkat : "Di Luar Zona Bahaya";
        return {
            x: jenis,
            y: levelOrder.indexOf(tingkat),
            label: tingkat,
            backgroundColor: warnaBahaya[tingkat]
        };
    });

    window.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: jenisBahayaTetap,
            datasets: [{
                label: 'Tingkat Bahaya',
                data: hasil,
                parsing: {
                    yAxisKey: 'y',
                    xAxisKey: 'x'
                },
                backgroundColor: hasil.map(d => d.backgroundColor)
            }]
        },
        options: {
            indexAxis: 'x',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'linear',
                    min: 0,
                    max: 3,
                    ticks: {
                        stepSize: 1,
                        callback: function (value) {
                            return levelOrder[value];
                        }
                    },
                    title: {
                        display: true,
                        text: "Tingkat Bahaya"
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            return `Tingkat Bahaya: ${hasil[ctx.dataIndex].label}`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Visualisasi Tingkat Bahaya per Jenis'
                }
            }
        }
    });
}
namaSekolahSelect.addEventListener("change", function () {
    const selectedNama = this.value;
    infografisTableBody.innerHTML = "";

    if (!selectedNama) return;

    if (selectedNama === "__ALL__") {
        // Tampilkan semua sekolah + overlay bahaya
        let semuaData = [];
        allSekolahFeatures.forEach((sekolah) => {
            semuaData = semuaData.concat(overlaySekolah(sekolah));
        });
        renderTabel(semuaData, true); // true artinya tanpa grafik
    } else {
        const sekolah = allSekolahFeatures.find(f => f.properties.poi_name === selectedNama);
        if (sekolah) {
            const overlayResult = overlaySekolah(sekolah);
            renderTabel(overlayResult);
        }
    }
});
filterSelect.addEventListener("change", function () {
    let selected = this.value;
    TitikSekolah.clearLayers();
    namaSekolahSelect.innerHTML = "<option value=''>Pilih Sekolah</option>";
    infografisTableBody.innerHTML = "";

    const filtered = allSekolahFeatures.filter((f) => selected === "ALL" || f.properties.Klasifikasi === selected);
    updateNamaSekolahDropdown(filtered);

    L.geoJSON(filtered, {
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                ...getSekolahStyle(feature.properties.Klasifikasi),
                pane: 'paneTitikSekolah'
            });
        },
        onEachFeature: function (feature, layer) {
            layer.on("click", function () {
                let popup = `<b>Nama Sekolah:</b> ${feature.properties.poi_name || "-"}<br>`;
                const latlng = layer.getLatLng();

                [
                    { label: "Gempa", data: dataBahayaGempaPolygons },
                    { label: "Longsor", data: dataBahayaLongsorPolygons },
                    { label: "Banjir", data: dataBahayaBanjirPolygons },
                    { label: "Cuaca Ekstrem", data: dataBahayaCuacaEkstremPolygons },
                ].forEach(b => {
                    let klasifikasi = "Di Luar Zona Bahaya";
                    if (b.data) {
                        let result = leafletPip.pointInLayer([latlng.lng, latlng.lat], L.geoJSON(b.data));
                        if (result.length > 0) klasifikasi = result[0].feature.properties.Klasifikas;
                    }
                    popup += `<b>Bahaya ${b.label}:</b> ${klasifikasi}<br>`;
                });
                layer.bindPopup(popup).openPopup();
            });
        }
    }).addTo(TitikSekolah);
});

$.getJSON("./asset/SLTAWGS.geojson", function (dataSekolah) {
    allSekolahFeatures = dataSekolah.features;
    filterSelect.dispatchEvent(new Event("change"));
});

// Export ke Excel
const exportExcelBtn = document.getElementById("exportExcel");
if (exportExcelBtn) exportExcelBtn.addEventListener("click", function () {
    let wb = XLSX.utils.book_new();
    let rows = [["Nama Sekolah", "Jenis Bahaya", "Tingkat Bahaya"]];
    document.querySelectorAll("#tabelInfografis tbody tr").forEach(tr => {
        let cols = Array.from(tr.children).map(td => td.innerText);
        rows.push(cols);
    });
    let ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Infografis");
    XLSX.writeFile(wb, "Infografis_Sekolah.xlsx");
});

// Export ke PDF
document.getElementById("exportPDF").addEventListener("click", function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text("Infografis Sekolah Rawan Bencana", 10, 10);

    // Ambil data tabel
    let rows = [];
    document.querySelectorAll("#tabelInfografis tbody tr").forEach(tr => {
        let cols = Array.from(tr.children).map(td => td.innerText);
        rows.push(cols);
    });

    // Buat tabel
    doc.autoTable({
        head: [["Nama Sekolah", "Jenis Bahaya", "Tingkat Bahaya"]],
        body: rows,
        startY: 20
    });

    // Ambil canvas chart dan konversi ke gambar
    const chartCanvas = document.getElementById("chartInfografis");
    const chartImage = chartCanvas.toDataURL("image/png", 1.0);

    // Tambahkan ke PDF setelah tabel
    const chartY = doc.lastAutoTable.finalY + 10; // posisi bawah tabel
    doc.addImage(chartImage, "PNG", 10, chartY, 180, 90); // (x, y, width, height)

    doc.save("Infografis_Sekolah.pdf");
});
