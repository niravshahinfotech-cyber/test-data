import React, { useState, useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import "./style.css";

/* ================= MASTER DATA ================= */

const processZoneMap = {
  "Batch Making": ["A"],
  "Dyeing": ["A", "B"]
};

const productionMaster = {
  "005100284174": {
    bigRolls: ["5100296880", "90014688"],
    material: "KFFRPCTN01241S",
    description: "24'S CTN PD 1X1RIB"
  },
  "005100284175": {
    bigRolls: ["90014689", "90014690"]
  }
};

/* ================= SHIFT ================= */
const getShift = () => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return "1";
  if (hour >= 14 && hour < 22) return "2";
  return "3";
};

/* ================= INITIAL FORM ================= */
const getInitialForm = () => {
  const defaultProcess = "Batch Making";
  const zones = processZoneMap[defaultProcess];

  return {
    date: new Date().toISOString().split("T")[0],
    shift: getShift(),
    user: "System User",
    process: defaultProcess,
    zone: zones.length === 1 ? zones[0] : "",
    trolleyNo: "",
    productionOrder: "",
    qty: "",
    bigRoll: "",
    material: "",
    description: "",
    remark: ""
  };
};

/* ================= STATIC DEFAULT TABLE ================= */
const defaultData = [
  {
    trolleyNo: "B-101",
    productionOrder: "005100284174",
    qty: "55",
    bigRoll: "90014688",
    material: "KFFRPCTN01241S",
    description: "24'S CTN PD 1X1RIB",
    remark: ""
  }
];

export default function App() {

  const [form, setForm] = useState(getInitialForm());

  // 🔥 MERGE DEFAULT + LOCAL STORAGE
  const [data, setData] = useState(() => {
    try {
      const stored = localStorage.getItem("wipData");
      const parsed = stored ? JSON.parse(stored) : [];
      return [...defaultData, ...parsed];
    } catch {
      return defaultData;
    }
  });

  const [selectedRows, setSelectedRows] = useState([]);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState("");
  const [editIndex, setEditIndex] = useState(null);
  const [scanEvents, setScanEvents] = useState([]);

  const dailyGoal = 16;
  const totalEntries = data.length;
  const progressPercent = totalEntries ? Math.min(100, Math.round((totalEntries / dailyGoal) * 100)) : 0;
  const dataCompleteness = totalEntries
    ? Math.round(
        (data.filter((item) => item.trolleyNo && item.productionOrder && item.qty).length / totalEntries) * 100
      )
    : 0;
  const scannedPOCount = data.filter((item) => item.productionOrder).length;
  const uniqueTrolleys = new Set(data.filter((item) => item.trolleyNo).map((item) => item.trolleyNo)).size;
  const activeScanGoal = scanTarget
    ? scanTarget === "productionOrder"
      ? "PO Scan"
      : "Trolley Scan"
    : "Idle";
  const recentScans = [...scanEvents].reverse().slice(0, 5);
  const scanActivityCount = scanEvents.length;

  const codeReader = useRef(new BrowserMultiFormatReader());
  const controlsRef = useRef(null);

  /* ================= SHOW NOTIFICATION ================= */
  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 3000);
  };

  /* ================= SAVE ONLY NEW DATA ================= */
  useEffect(() => {
    const newData = data.slice(defaultData.length);
    localStorage.setItem("wipData", JSON.stringify(newData));
  }, [data]);

  /* ================= HANDLE CHANGE ================= */
  const handleChange = (e) => {
    const { name, value } = e.target;
    let updated = { ...form, [name]: value };

    // Zone auto
    if (name === "process") {
      const zones = processZoneMap[value] || [];
      updated.zone = zones.length === 1 ? zones[0] : "";
    }

    // Production Order mapping
    if (name === "productionOrder") {
      const record = productionMaster[value];

      if (record) {
        updated.bigRoll =
          record.bigRolls.length === 1 ? record.bigRolls[0] : "";
        updated.material = record.material || "";
        updated.description = record.description || "";
      }
      // If not in master data, leave fields empty for manual entry
    }

    setForm(updated);
  };

  /* ================= COMMON SCAN LOGIC ================= */
  const recordScanEvent = (label) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setScanEvents((prev) => [...prev, { label, time }].slice(-12));
  };

  const processScan = (raw, target) => {
    const numbers = raw.replace(/\D/g, "");
    
    if (!numbers) {
      showNotification("Invalid barcode", "error");
      return;
    }

    recordScanEvent(`Scanned ${target === "productionOrder" ? "PO" : "Trolley"}: ${numbers}`);

    // Accept any barcode number for the target field
    handleChange({
      target: {
        name: target,
        value: numbers
      }
    });
  };

  /* ================= FILE UPLOAD ================= */
  const handleFileUpload = async (e, target) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const result = await codeReader.current.decodeFromImageUrl(
        URL.createObjectURL(file)
      );
      processScan(result.getText(), target);
      
      if (target === "productionOrder") {
        showNotification("✅ PO Number Updated!");
        recordScanEvent("Uploaded PO barcode image");
      } else if (target === "trolleyNo") {
        showNotification("✅ Trolley Number Updated!");
        recordScanEvent("Uploaded trolley barcode image");
      }
    } catch {
      showNotification("❌ Barcode not detected", "error");
    }
  };

  /* ================= CAMERA ================= */
  const startScanner = async (target) => {
    try {
      setScannerOpen(true);
      setScanTarget(target);

      const videoElement = document.getElementById("reader");
      if (videoElement) {
        videoElement.style.display = "block";
      }

      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }

      controlsRef.current = await codeReader.current.decodeFromVideoDevice(
        null,
        videoElement,
        (result) => {
          if (result) {
            processScan(result.getText(), target);

            if (target === "productionOrder") {
              showNotification("✅ PO Number Scanned!");
            } else if (target === "trolleyNo") {
              showNotification("✅ Trolley Number Scanned!");
            }

            stopScanner();
          }
        }
      );
    } catch (error) {
      stopScanner();
      showNotification(`Camera error: ${error.message || 'Unknown error'}`, "error");
      console.error('Camera scan failed:', error);
    }
  };

  const stopScanner = () => {
    try {
      if (controlsRef.current) {
        if (typeof controlsRef.current.stop === "function") {
          controlsRef.current.stop();
        }
        controlsRef.current = null;
      }
    } catch (error) {
      console.error("Error stopping scanner:", error);
    }

    setScannerOpen(false);
    setScanTarget("");

    const videoElement = document.getElementById("reader");
    if (videoElement) {
      videoElement.style.display = "none";
      if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach((track) => track.stop());
        videoElement.srcObject = null;
      }
    }
  };

  /* ================= ADD ================= */
  const handleAdd = () => {
    if (!form.productionOrder || !form.qty) {
      showNotification("Production Order & Qty required", "error");
      return;
    }

    if (editIndex !== null) {
      setData(prev => prev.map((item, index) => index === editIndex ? form : item));
      setEditIndex(null);
      showNotification("Record updated successfully!", "success");
      recordScanEvent("Updated entry");
    } else {
      setData(prev => [...prev, form]);
      showNotification("Record posted successfully!", "success");
      recordScanEvent("Posted entry");
    }

    setForm(getInitialForm());
  };

  const handleEdit = (index) => {
    const row = data[index] || {};
    setForm({
      ...getInitialForm(),
      ...row
    });
    setEditIndex(index);
    showNotification("Edit mode enabled. Update the form and click Post.", "success");
  };

  const handleCancelEdit = () => {
    setEditIndex(null);
    setForm(getInitialForm());
    showNotification("Edit cancelled.", "success");
  };

  /* ================= DELETE ================= */
  const handleDelete = () => {
    const updated = data.filter((_, i) => !selectedRows.includes(i));
    setData(updated);
    setSelectedRows([]);
  };

  const handleCheckbox = (index) => {
    if (selectedRows.includes(index)) {
      setSelectedRows(selectedRows.filter(i => i !== index));
    } else {
      setSelectedRows([...selectedRows, index]);
    }
  };

  return (
    <div className="app">

      {/* NOTIFICATION TOAST */}
      {notification.message && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* HERO */}
      <div className="hero hero-simple">
        <div className="hero-copy">
          <h1>Smart Fabric Entry Generator</h1>
          <p>Scan, edit, and post production entries in a clean modern interface.</p>
        </div>
      </div>

      {/* CARD */}
      <div className="card">

        <div className="card-header">
          <div>
            <h3 className="title">Knits Fabric Process Tracking</h3>
            <p className="subtitle">Modern paperless tracking for fabric production, barcode scanning, and batch flow control.</p>
          </div>
          <div className="badge-row">
            <span className="badge">Total entries: {data.length}</span>
            <span className="badge">Selected: {selectedRows.length}</span>
            <span className="badge">Scanner: {scannerOpen ? "Active" : "Closed"}</span>
          </div>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <span className="summary-icon">📊</span>
            <div>
              <strong>{totalEntries}</strong>
              <p>Total entries</p>
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-icon">📦</span>
            <div>
              <strong>{scannedPOCount}</strong>
              <p>POs recorded</p>
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-icon">🚚</span>
            <div>
              <strong>{uniqueTrolleys}</strong>
              <p>Unique trolleys</p>
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-icon">🎯</span>
            <div>
              <strong>{activeScanGoal}</strong>
              <p>Current goal</p>
            </div>
          </div>
        </div>

        <div className="activity-grid">
          <div className="progress-widget">
            <div className="widget-header">
              <strong>Daily target progress</strong>
              <span>{progressPercent}%</span>
            </div>
            <p>{totalEntries} of {dailyGoal} entries completed</p>
            <div className="progress-bar">
              <span style={{ width: `${progressPercent}%` }}></span>
            </div>
          </div>

          <div className="progress-widget">
            <div className="widget-header">
              <strong>Data completeness</strong>
              <span>{dataCompleteness}%</span>
            </div>
            <p>{dataCompleteness}% of entries have key production fields</p>
            <div className="progress-bar accent">
              <span style={{ width: `${dataCompleteness}%` }}></span>
            </div>
          </div>

          <div className="activity-card">
            <div className="widget-header">
              <strong>Scan activity</strong>
              <span>{scanActivityCount} events</span>
            </div>
            <div className="activity-list">
              {recentScans.length ? (
                recentScans.map((event, index) => (
                  <div key={index} className="activity-item">
                    <span>{event.label}</span>
                    <strong>{event.time}</strong>
                  </div>
                ))
              ) : (
                <div className="activity-empty">No scan activity yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="scanner-panel-wrapper">
          <div className={`scanner-panel ${scannerOpen ? "open" : "minimized"}`}>
            <div className="scanner-header">
              <div>
                <strong>Scanner console</strong>
                <p className="scanner-status">
                  {scannerOpen ? "Camera ready for scan" : "Scanner minimized"}
                </p>
              </div>
              <button className="scanner-toggle" onClick={() => (scannerOpen ? stopScanner() : setScannerOpen(true))}>
                {scannerOpen ? "Close" : "Open"}
              </button>
            </div>

            <div className="scanner-body">
              <div className="upload-row">
                <label className="upload-card">
                  <span>Upload PO</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, "productionOrder")}
                  />
                </label>
                <label className="upload-card">
                  <span>Upload Trolley</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, "trolleyNo")}
                  />
                </label>
              </div>

              <video id="reader"></video>

              <div className="button-grid">
                <button className="post" onClick={() => startScanner("productionOrder")}>Scan Production Order</button>
                <button className="post" onClick={() => startScanner("trolleyNo")}>Scan Trolley No</button>
                <button className="delete" onClick={stopScanner}>Stop Scan</button>
              </div>
            </div>
          </div>
        </div>

        <div className="form-block">
          <div className="form-wrapper">
            <div className="form-left">
              <div className="floating">
                <span className="icon">📅</span>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  placeholder=" "
                />
                <label>Date</label>
              </div>

              <div className="floating">
                <span className="icon">👤</span>
                <input value={form.user} readOnly placeholder=" " />
                <label>User</label>
              </div>

              <div className="floating">
                <span className="icon">📍</span>
                <select name="zone" value={form.zone} onChange={handleChange}>
                  <option value=""></option>
                  <option>A</option>
                  <option>B</option>
                </select>
                <label>Zone</label>
              </div>

              <div className="floating">
                <span className="icon">🚚</span>
                <input name="trolleyNo" value={form.trolleyNo} onChange={handleChange} placeholder=" " />
                <label>Trolley No</label>
              </div>

              <div className="floating">
                <span className="icon">📦</span>
                <input name="productionOrder" value={form.productionOrder} onChange={handleChange} placeholder=" " />
                <label>Production Order</label>
              </div>

              <div className="floating">
                <span className="icon">🔢</span>
                <input name="qty" value={form.qty} onChange={handleChange} placeholder=" " />
                <label>Individual Capacity</label>
              </div>
            </div>

            <div className="form-right">
              <div className="floating">
                <span className="icon">⏱</span>
                <input value={form.shift} readOnly />
                <label>Shift</label>
              </div>

              <div className="floating">
                <span className="icon">⚙️</span>
                <select name="process" value={form.process} onChange={handleChange}>
                  <option value=""></option>
                  <option>Batch Making</option>
                  <option>Dyeing</option>
                </select>
                <label>Process</label>
              </div>

              <div className="floating">
                <span className="icon">📝</span>
                <input name="remark" value={form.remark} onChange={handleChange} placeholder=" " />
                <label>Remark</label>
              </div>

              <div className="floating">
                <span className="icon">🧵</span>
                <input name="bigRoll" value={form.bigRoll} onChange={handleChange} placeholder=" " />
                <label>Big Roll</label>
              </div>
            </div>
          </div>

          <div className="btn-center action-row">
            <button className="delete" onClick={handleDelete}>Delete Selected</button>
            <div className="action-group">
              {editIndex !== null && (
                <button className="delete secondary" onClick={handleCancelEdit}>
                  Cancel Edit
                </button>
              )}
              <button className="post" onClick={handleAdd}>
                {editIndex !== null ? "Update Entry" : "Post Entry"}
              </button>
            </div>
          </div>
        </div>

        <div className="table-section">
          <div className="table-header">
            <h4>Scanned Data</h4>
            <p>Review and manage all scanned production entries in one modern dashboard.</p>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Trolley No</th>
                  <th>Remarks</th>
                  <th>Prod Order</th>
                  <th>Qty</th>
                  <th>Big Roll</th>
                  <th>Material</th>
                  <th>Description</th>
                  <th>Edit</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr key={index} className={editIndex === index ? "editing-row" : ""} onDoubleClick={() => handleEdit(index)}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(index)}
                        onChange={() => handleCheckbox(index)}
                      />
                    </td>
                    <td>{item.trolleyNo}</td>
                    <td>{item.remark}</td>
                    <td>{item.productionOrder}</td>
                    <td>{item.qty}</td>
                    <td>{item.bigRoll}</td>
                    <td>{item.material}</td>
                    <td>{item.description}</td>
                    <td>
                      <button className="row-edit" onClick={() => handleEdit(index)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
