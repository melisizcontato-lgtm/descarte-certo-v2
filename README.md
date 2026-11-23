# Descarte Certo

Aplicação web responsiva para localizar pontos de coleta, sugerir novos locais, avaliar a experiência e moderar cadastros. O projeto usa Node.js e recursos nativos, sem dependências externas; pontos e avaliações são persistidos em `data/points.json` e `data/feedback.json`.

## Executar

Requer Node.js 18 ou superior:

```powershell
node server.js
```

Abra [http://localhost:3000](http://localhost:3000). Para escolher outra porta ou credenciais de administração, configure as variáveis antes de iniciar:

```powershell
$env:PORT = "3000"
$env:ADMIN_USER = "admin"
$env:ADMIN_PASSWORD = "defina-uma-senha-forte"
$env:NOMINATIM_CONTACT = "contato@seu-dominio.com"
node server.js
```

### Usar com o Live Server do VS Code

Se abrir o projeto em `http://127.0.0.1:5500` ou `http://localhost:5500`, mantenha o Live Server aberto e inicie também `node server.js` no terminal do VS Code. O site detecta o endereço local do Live Server e conecta à API na porta 3000. Se o navegador não atualizar o código, atualize a página com `Ctrl+F5`.

Para a apresentação local inicial, o acesso padrão é `admin` / `Descarte@2026`. Essa senha de demonstração deve ser substituída antes de qualquer implantação ou exposição na rede.

## Fluxo de uso

- Visitantes pesquisam pontos aprovados por material, cidade, bairro, endereço ou CEP. A busca ignora diferenças de acentuação e prioriza correspondências exatas de bairro.
- A busca externa parte do centro geográfico retornado pelo geocodificador e encontra até 100 locais em até 20 km; um raio amplo pode ser reduzido automaticamente para 5 km se o serviço expirar. Ela não é um catálogo nacional completo: a cobertura varia conforme os dados mapeados pela comunidade em cada município.
- Na página de pesquisa, a pessoa pode consultar locais mapeados pelo OpenStreetMap digitando uma cidade/bairro ou usando o botão de localização. A localização do navegador só é acessada após a pessoa escolher esse botão; buscas digitadas enviam o texto ao serviço de mapas para geocodificação.
- Resultados do OpenStreetMap são dados comunitários, não são verificados pela equipe e podem estar incompletos; materiais e funcionamento devem ser confirmados com o local. A interface atribui os dados ao OpenStreetMap.
- A busca externa usa Nominatim para localizar o lugar e uma instância pública da Overpass API para procurar pontos públicos de reciclagem/descarte em um raio de até 20 km. O serviço depende da disponibilidade e da cobertura desses projetos; não há garantia de uma lista nacional completa nem de avaliações do Google Maps. Para avaliações e dados do Google Places, é necessário configurar uma chave e faturamento da plataforma Google; o site não coleta nem simula essas notas.
- Em implantação pública, configure `NOMINATIM_CONTACT` com um contato ou URL do projeto e respeite os limites de uso do Nominatim; o endpoint Overpass pode ser ajustado com `OVERPASS_URL`.
- A localização do navegador só funciona em contexto seguro (HTTPS ou `localhost`) e sempre depende da permissão concedida pela própria pessoa.
- Lixões a céu aberto não são recomendados como destino. A busca mostra apenas instalações públicas mapeadas como reciclagem/descarte e avisa quando materiais aceitos não estão informados.
- Novos cadastros são validados e ficam pendentes; não há estabelecimentos fictícios ou dados demonstrativos apresentados como reais.
- Bairro e CEP são opcionais no cadastro; preencher esses campos melhora a precisão da pesquisa por região.
- O administrador autentica-se em **Área administrativa** para revisar, aprovar, rejeitar, editar ou excluir cadastros.
- Os dados ficam em `data/points.json`, criado automaticamente na primeira execução. Faça cópias desse arquivo para manter backups.
- A página inicial aceita avaliações de 1 a 5 estrelas e um comentário opcional. A média e a quantidade exibidas são calculadas exclusivamente a partir das avaliações realmente enviadas; comentários ficam restritos à área administrativa, onde podem ser excluídos. O envio é limitado a uma avaliação por endereço IP a cada 30 segundos. Faça cópia de `data/feedback.json` para manter backups.
- Animações de entrada reaparecem ao rolar a página para cima ou para baixo e respeitam a preferência do sistema por movimento reduzido.

## Notas de implantação

As sessões administrativas usam cookies `HttpOnly` e `SameSite=Strict`, expiram após oito horas e são limitadas após tentativas inválidas. O armazenamento JSON é uma opção simples para apresentação local ou uso de baixo volume; para múltiplos servidores ou operação de produção, prefira um banco de dados gerenciado e coloque o serviço atrás de HTTPS. Em `NODE_ENV=production`, o cookie da sessão recebe o atributo `Secure`.
