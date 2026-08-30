PAPERPEL — AVALIAÇÕES AUTOMÁTICAS DO GOOGLE

1. Abra config.js e substitua COLE_SUA_CHAVE_AQUI pela sua chave da Google Maps Platform.
2. No Google Cloud, ative: Maps JavaScript API, Places API e Places API (New).
3. Restrinja a chave por HTTP referrer ao domínio do GitHub Pages/site da Paperpel.
4. Suba os arquivos mantendo a pasta assets.

O site procura automaticamente a Paperpel pelo endereço e busca a nota, quantidade de avaliações e até 5 avaliações disponíveis, incluindo o nome e a foto de perfil do autor quando o Google fornecer esses dados. A seção mostra somente avaliações de 5 estrelas, conforme solicitado.

IMPORTANTE: a chave de API usada em um site estático fica visível no navegador. Por isso, a restrição por HTTP referrer é obrigatória na prática para evitar uso indevido.
