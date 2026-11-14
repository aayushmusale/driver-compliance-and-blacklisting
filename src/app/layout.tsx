import "./globals.css";

export const metadata = { title: "Driver Compliance Platform", description: "Supreme Facilities Management - prototype" };

export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
