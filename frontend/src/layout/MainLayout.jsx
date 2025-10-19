import Sidebar from "../components/Sidebar";

export default function MainLayout({ children }) {
  return (
    <>
      <Sidebar />
      <div
        style={{
          marginLeft: "240px", // 👈 gleiche Breite wie Sidebar
          padding: "24px",
          minHeight: "100vh",
          background: "#f8f9fa"
        }}
      >
        {children}
      </div>
    </>
  );
}
