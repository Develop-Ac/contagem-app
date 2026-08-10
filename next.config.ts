import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Gera um servidor autocontido em `.next/standalone`, com apenas as
   * dependências realmente usadas em tempo de execução. É o que permite a
   * imagem Docker final não carregar o `node_modules` inteiro.
   */
  output: "standalone",
};

export default nextConfig;
