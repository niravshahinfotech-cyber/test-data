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
  const processScan = (raw, target) => {
    const numbers = raw.replace(/\D/g, "");
    
    if (!numbers) {
      showNotification("Invalid barcode", "error");
      return;
    }

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
      } else if (target === "trolleyNo") {
        showNotification("✅ Trolley Number Updated!");
      }
    } catch {
      showNotification("❌ Barcode not detected", "error");
    }
  };

  /* ================= CAMERA ================= */
  const startScanner = async (target) => {
    try {
      const videoElement = document.getElementById("reader");
      if (videoElement) {
        videoElement.style.display = "block";
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
      showNotification(`Camera error: ${error.message || 'Unknown error'}`, "error");
      console.error('Camera scan failed:', error);
    }
  };

  const stopScanner = () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
    }
    const videoElement = document.getElementById("reader");
    if (videoElement) {
      videoElement.style.display = "none";
    }
  };

  /* ================= ADD ================= */
  const handleAdd = () => {
    if (!form.productionOrder || !form.qty) {
      showNotification("Production Order & Qty required", "error");
      return;
    }

    setData(prev => [...prev, form]);
    setForm(getInitialForm());
    showNotification("Record posted successfully!", "success");
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
      <div className="hero">
        <h1>Easy Process with Online Registration</h1>
        <p>Fast • Secure • Paperless</p>
      </div>

      {/* CARD */}
      <div className="card">

        <h3 className="title">Knits Fabric Process Tracking</h3>

        {/* UPLOAD */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
          <div className="floating" style={{ flex: 1, marginBottom: 0 }}>
            <span className="icon">📤</span>
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => handleFileUpload(e, "productionOrder")}
            />
            <label>Upload PO</label>
          </div>
          <div className="floating" style={{ flex: 1, marginBottom: 0 }}>
            <span className="icon">📤</span>
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => handleFileUpload(e, "trolleyNo")}
            />
            <label>Upload Trolley</label>
          </div>
        </div>

        {/* CAMERA */}
        <video id="reader"></video>

        <div className="btn-center scan-btn-wrapper">
          <button 
            className="post" 
            onClick={() => startScanner("productionOrder")}
          >
            Scan Production Order
          </button>
          <button 
            className="post" 
            onClick={() => startScanner("trolleyNo")}
          >
            Scan Trolley No
          </button>
       {/*  <button className="delete" onClick={stopScanner}>Stop Scan</button> */} 
        </div>

        {/* FORM */}
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

        {/* TABLE */}
        <h4>Scanned Data</h4>

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
              </tr>
            </thead>

            <tbody>
              {data.map((item, index) => (
                <tr key={index}>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* BUTTONS */}
        <div className="btn-center">
          <button className="delete" onClick={handleDelete}>
            Delete Selected
          </button>
          <button className="post" onClick={handleAdd}>
            Post
          </button>
        </div>

      </div>
    </div>
  );
}