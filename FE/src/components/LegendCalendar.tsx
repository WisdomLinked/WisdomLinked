import React from "react";

const LegendCalendar = () => {
  return (
    <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}> 
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <div
          style={{
            width: "20px",
            height: "20px",
            backgroundColor: "#f94144",
            borderRadius: "4px",
          }}
        ></div>
        <span style={{ color: "white" }}>No Availability</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <div
          style={{
            width: "20px",
            height: "20px",
            backgroundColor: "#f9a826",
            borderRadius: "4px",
          }}
        ></div>
        <span style={{ color: "white" }}>Partial Availability</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <div
          style={{
            width: "20px",
            height: "20px",
            backgroundColor: "#30B199",
            borderRadius: "4px",
          }}
        ></div>
        <span style={{ color: "white" }}>Full Availability</span>
      </div>
    </div>
  );
};

export default LegendCalendar;
