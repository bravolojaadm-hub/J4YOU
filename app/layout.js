import './globals.css';

export const metadata = {
  title: 'J4Y — Painel de Precificação',
  description: 'Painel de custos, preços e lucros por marketplace',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
