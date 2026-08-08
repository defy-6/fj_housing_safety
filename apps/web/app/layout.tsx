import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "福建省房屋安全动态监测平台",
  description: "福建省房屋安全省市县多层级可视化监测大屏",
  icons: {icon: "/favicon.svg"},
  openGraph: {
    title: "福建省房屋安全动态监测平台",
    description: "一图统览 · 分级钻取 · 年度监测",
    images: [{url: "/og.png", width: 1200, height: 630}],
  },
  twitter: {card: "summary_large_image", images: ["/og.png"]},
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="zh-CN"><body>{children}</body></html>;
}
