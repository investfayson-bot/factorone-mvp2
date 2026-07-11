# FactorOne Design Tokens — extraído dos mockups aprovados

Fonte da verdade para cor, espaçamento e tipografia. NÃO adivinhar valores olhando print — usar exatamente isto.

## Cores
```css
--sb: #0C1D16;          /* sidebar bg (verde-escuro quase preto) */
--sb2: #12271E;          /* sidebar bg secundário */
--sb-line: rgba(255,255,255,.07);

--acc: #16A34A;          /* verde principal (botões, ícones ativos) */
--acc2: #22C55E;         /* verde vivo (badges, highlights) */
--acc-soft: #E7F5EC;     /* fundo verde claro (chips positivos) */
--acc-ink: #0E7A38;      /* texto verde escuro sobre fundo claro */

--bg: #F3F6F4;           /* fundo geral da aplicação */
--card: #FFFFFF;         /* fundo dos cards */
--line: #E5EBE7;         /* borda padrão */
--line2: #D8E0DB;        /* borda mais forte (inputs) */

--ink: #111C16;          /* texto principal */
--mut: #68746E;          /* texto secundário */
--mut2: #93A09A;         /* texto terciário / placeholder */

--neg: #DE4B4B;          /* vermelho (negativo, alerta) */
--neg-soft: #FCECEC;
--warn: #D97706;         /* âmbar (atenção) */
--warn-soft: #FBF1E2;

--r: 12px;    /* border-radius padrão de card */
--r-sm: 9px;  /* border-radius pequeno */
```

## Tipografia
- Títulos, números, valores monetários, KPIs → **Space Grotesk** (700 títulos, 500 números menores)
- Corpo, labels, texto de UI → **Manrope** (600/700/800 para pesos)
- Google Fonts: `Space+Grotesk:wght@500;700` e `Manrope:wght@600;700;800`
- Tamanho base do body: 13px, line-height 1.45

## Espaçamento e estrutura
- Sidebar: 224px fixa, padding 16px 12px 12px
- Layout raiz: `grid-template-columns: 224px 1fr`
- Conteúdo: padding 20px 24px 28px, gap 14px entre blocos
- Cards: padding 14px 16px, border 1px solid var(--line), border-radius 12px
- Topbar: padding 12px 24px, border-bottom 1px solid var(--line)

## Padrões de componente (já resolvidos nos mockups, reaproveitar)
- **Sidebar**: item ativo tem barra verde de 3px à esquerda + gradiente sutil de fundo
- **Módulo com sub-abas**: header do módulo (`.mod-head`) fica fora do `.content`, abas com sublinha verde de 2.5px no item ativo
- **Card "Por que mudou" / IA**: fundo `linear-gradient(135deg,#0C1D16,#143526)`, badge "FACTORONE AI" verde
- **KPI card**: border-top 3px colorido (verde padrão, vermelho para negativo, âmbar para atenção)
- **Toggle on/off**: usar os ícones `i-toggle-on` / `i-toggle-off` do arquivo de ícones (verde preenchido = on, cinza = off)
- **Chip de status**: `.chip.g` (verde/positivo), `.chip.y` (âmbar/atenção), `.chip.r` (vermelho/urgente)

## Arquivos deste pacote
- `base.css` — todas as variáveis + classes compartilhadas (sidebar, topbar, cards, kpis)
- `01-inicio.html` a `09-precificacao.html` — 9 telas completas, cada uma com seus estilos específicos inline em `<style>`
- Cada arquivo já contém os ícones SVG inline (não precisa de biblioteca de ícones externa)
