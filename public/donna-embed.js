/*!
 * Donna — widget de atendimento do FactorOne.
 * Cole no seu site: <script src="https://SEU-DOMINIO/donna-embed.js" data-slug="seu-slug" defer></script>
 * data-slug (obrigatório): o slug do seu site no FactorOne (Marketing → Gere seu site).
 * data-cor, data-nome (opcionais): sobrescrevem a cor/nome do widget.
 */
(function () {
  var scripts = document.getElementsByTagName('script')
  var atual = scripts[scripts.length - 1]
  var slug = atual.getAttribute('data-slug')
  if (!slug) { console.error('[Donna] Faltou data-slug no <script> do widget.'); return }
  var cor = atual.getAttribute('data-cor') || ''
  var nome = atual.getAttribute('data-nome') || ''

  var origem = 'https://factorone-mvp2.vercel.app'
  try { if (atual.src) origem = new URL(atual.src).origin } catch (e) { /* mantém default */ }

  var qs = 'cor=' + encodeURIComponent(cor) + '&nome=' + encodeURIComponent(nome)
  var iframe = document.createElement('iframe')
  iframe.src = origem + '/widget/' + encodeURIComponent(slug) + '?' + qs
  iframe.title = 'Chat'
  iframe.setAttribute('allowtransparency', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '20px'
  iframe.style.bottom = '20px'
  iframe.style.width = '76px'
  iframe.style.height = '76px'
  iframe.style.border = 'none'
  iframe.style.background = 'transparent'
  iframe.style.zIndex = '2147483000'
  iframe.style.colorScheme = 'normal'

  function montar() {
    if (document.body) document.body.appendChild(iframe)
    else document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(iframe) })
  }
  montar()

  window.addEventListener('message', function (ev) {
    if (!ev || !ev.data || ev.data.tipo !== 'donna-widget') return
    if (ev.source !== iframe.contentWindow) return
    if (ev.data.aberto) {
      iframe.style.width = '340px'
      iframe.style.height = '460px'
    } else {
      iframe.style.width = '76px'
      iframe.style.height = '76px'
    }
  })
})()
