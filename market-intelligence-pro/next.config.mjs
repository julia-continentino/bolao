/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bibliotecas de exportação rodam apenas no servidor (Node.js)
  serverExternalPackages: ["pdfkit", "exceljs", "pptxgenjs", "docx", "@prisma/client", "bcryptjs"],
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
};
export default nextConfig;
