# **Relatório de Engenharia de Software e Especificação Técnica: Plataforma SaaS Multi-Tenant de Mobilidade baseada em PWA**

A migração de plataformas de mobilidade urbana do modelo tradicional de aplicativos nativos para soluções puramente baseadas na web exige um planejamento rigoroso de arquitetura de software.1 Este relatório apresenta uma análise crítica e uma redefinição arquitetural completa para a viabilidade técnica de uma plataforma SaaS multi-tenant de transporte privado (estilo Uber) operando exclusivamente como um Aplicativo Web Progressivo (PWA).1  
O foco deste documento é estritamente técnico, visando à eliminação de falhas estruturais, à redução de custos operacionais de APIs e ao provisionamento de uma arquitetura resiliente, de fácil manutenção e imune a gargalos operacionais comuns.1

## **1\. Relatório de Inconsistências e Erros Críticos na Documentação Anterior**

Uma avaliação aprofundada da arquitetura de referência inicial revela suposições equivocadas que impactariam diretamente a estabilidade do sistema em ambiente produtivo.1 A tabela a seguir consolida as falhas detectadas e as respectivas correções de engenharia aplicadas nesta nova especificação:

| Erro Detectado na Documentação Inicial | Impacto Técnico | Resolução de Engenharia Aplicada |
| :---- | :---- | :---- |
| **Rastreamento de geolocalização em segundo plano via PWA no iOS**.1 | O sistema operacional iOS suspende os processos de aplicativos web em segundo plano quase imediatamente, interrompendo o envio de coordenadas.2 | Implementação da *Screen Wake Lock API* para manter o aplicativo ativo no painel do motorista 5 com estrutura pronta para encapsulamento híbrido via CapacitorJS.4 |
| **Exigência de Split de Pagamento com o Mercado Pago no MVP**.1 | Fricção no onboarding dos motoristas devido à necessidade de vinculação de contas via fluxo OAuth2 complexo e burocrático.8 | Desacoplamento do split nesta fase. Pagamento digital direto para a conta do respectivo tenant.1 Preparação da arquitetura de dados para o split via Asaas na Fase 2\.1 |
| **Premissa de escala ilimitada no plano gratuito do Supabase**.1 | A cota gratuita limita conexões síncronas de realtime em 200 conexões simultâneas, capacidade facilmente esgotada por um único tenant ativo.11 | Descentralização do fluxo de realtime, otimização de payloads e estabelecimento de uma política rigorosa de degradação elegante para long-polling.1 |
| **Centralização de custos de APIs de mapas no Super Admin**.1 | Quebra financeira do provedor do SaaS devido ao custo cumulativo de geocodificação e rotas de múltiplos inquilinos.1 | Descentralização completa das chaves de API. Cada cliente configura, gerencia e custeia seus próprios provedores de mapas em seu painel.1 |

## **2\. Viabilidade Técnica do PWA e Mitigação de Restrições em Dispositivos Móveis**

A execução de um serviço de mobilidade sem a publicação nas lojas oficiais da Google e da Apple exige o entendimento detalhado das barreiras impostas pelos navegadores móveis, especialmente o motor WebKit do Safari no iOS.2

### **Desafios de Rastreamento de Geolocalização em Segundo Plano**

A maior barreira técnica para um aplicativo de transporte web é a suspensão de Service Workers em segundo plano no ecossistema iOS.2 Quando um motorista minimiza o navegador para visualizar uma rota no Waze ou simplesmente bloqueia a tela do aparelho, o navegador Safari interrompe a execução de scripts de rastreamento de localização ativa.2  
No Android, o Chrome gerencia o ciclo de vida de forma mais flexível, permitindo que a geolocalização foreground e background continue por mais tempo se o aplicativo estiver associado a uma notificação ativa de primeiro plano.4

### **Estratégias de Mitigação no Navegador**

#### **Implementação da Screen Wake Lock API**

Para garantir que o PWA do motorista não entre em modo de suspensão durante o expediente, o sistema ativa a *Screen Wake Lock API*.6 Esta tecnologia, amplamente compatível com navegadores modernos a partir do primeiro semestre de 2024 (incluindo Safari 16.4+ e Chrome 84+) 5, solicita ao sistema operacional que mantenha a tela do dispositivo acesa de forma ininterrupta enquanto o aplicativo estiver em foco.6

JavaScript  
let wakeLockSentinel \= null;

async function requestScreenWakeLock() {  
  try {  
    if ('wakeLock' in navigator) {  
      wakeLockSentinel \= await navigator.wakeLock.request('screen');  
      wakeLockSentinel.addEventListener('release', () \=\> {  
        console.log('Screen Wake Lock liberado.');  
      });  
      console.log('Screen Wake Lock ativado com sucesso.');  
    }  
  } catch (err) {  
    console.warn(\`Falha ao obter Wake Lock: ${err.name} \- ${err.message}\`);  
  }  
}

// Reativação automática do bloqueio de suspensão ao retomar foco  
document.addEventListener('visibilitychange', async () \=\> {  
  if (wakeLockSentinel\!== null && document.visibilityState \=== 'visible') {  
    await requestScreenWakeLock();  
  }  
});

Este mecanismo força o dispositivo a permanecer ativo no suporte veicular do motorista, permitindo que a função navigator.geolocation.watchPosition() envie coordenadas em tempo real sem interrupções operacionais.6

#### **Loop de Áudio Silencioso**

Como redundância opcional no iOS, o PWA executa um loop contínuo de um arquivo de áudio inaudível (por exemplo, frequência de ![][image1] ou silêncio absoluto parametrizado em tag \<audio\> clássica).17 O iOS prioriza a atividade de abas que reproduzem som de forma contínua em segundo plano, evitando o congelamento temporário do JavaScript do PWA se o motorista alternar rapidamente para um app de navegação de terceiros.17

#### **Preparação de Rota de Fuga Tecnológica com CapacitorJS**

Se as restrições de segundo plano do WebKit no iOS se mostrarem excessivas para a base de motoristas em testes reais, o código-fonte desenvolvido em Next.js e React no monorepo é estruturalmente preparado para ser empacotado de maneira híbrida usando o **CapacitorJS**.4 O Capacitor encapsula a aplicação web existente dentro de uma WebView nativa leve.7  
Dessa forma, o sistema obtém acesso às APIs nativas de geolocalização do iOS e Android (como o plugin @capacitor/geolocation), que funcionam de modo resiliente em segundo plano e com tela bloqueada, sem demandar qualquer refatoração no ecossistema lógico do backend.20

## **3\. Arquitetura de Acesso, Onboarding Dinâmico e Multi-Tenancy**

O sistema é projetado sob o modelo arquitetural de banco de dados compartilhado com isolamento lógico rígido baseado em Row Level Security (RLS) no PostgreSQL do Supabase.1 Isso garante que os dados de cada tenant sejam completamente invisíveis para os demais inquilinos de forma nativa.1

### **Hierarquia de Níveis de Acesso**

A plataforma divide os privilégios lógicos em quatro camadas distintas de usuários 1:

\+--------------------------------------------------------------------------+  
| Super Admin (Dono da Plataforma SaaS Geral)                              |  
\+------------------------------------+-------------------------------------+  
                                     |  
                                     v  
\+--------------------------------------------------------------------------+  
| Tenant Admin (Dono da Operação de Mobilidade Contratante)                |  
\+------------------------------------+-------------------------------------+  
                                     |  
                  \+------------------+------------------+  
                  |                                     |  
                  v                                     v  
\+----------------------------------+ \+-------------------------------------+  
| Drivers (Motoristas Vinculados)  | | Passengers (Passageiros Vinculados) |  
\+----------------------------------+ \+-------------------------------------+

### **Fluxo de Onboarding Self-Service Simplificado**

O onboarding de novos clientes é realizado através de uma interface self-service intuitiva.1 O fluxo técnico é projetado para durar menos de cinco minutos e consiste nas seguintes etapas:

#### **1\. Verificação de Nome e Subdomínio na Vercel**

O cliente insere o nome desejado para o seu aplicativo.1 O sistema valida em tempo real a disponibilidade do subdomínio em relação à URL padrão configurada no wildcard da Vercel (por exemplo, nomeescolhido.suaplataforma.com.br) 22:

TypeScript  
// Exemplo de verificação de disponibilidade via API Route no Next.js  
export async function GET(request: Request) {  
  const { searchParams } \= new URL(request.url);  
  const slug \= searchParams.get('slug');  
    
  const { data, error } \= await supabase  
   .from('companies')  
   .select('id')  
   .eq('slug', slug)  
   .maybeSingle();

  if (data) {  
    return Response.json({ available: false }, { status: 200 });  
  }  
  return Response.json({ available: true }, { status: 200 });  
}

#### **2\. Cadastro de Dados Cadastrais e Governança**

O cliente preenche o cadastro básico contendo dados fiscais e operacionais: Nome Completo, CPF/CNPJ, RG, Cidade Sede e dados de contato.1

#### **3\. Upload de Branding Visual (Branding em Runtime)**

O cliente realiza o upload do logotipo em formato vetorizado (SVG) ou imagem de alta definição (PNG).1 O sistema oferece uma paleta padrão de temas e permite a personalização de duas cores hexadecimais básicas (Cor Primária e Cor Secundária).1  
A customização visual é renderizada dinamicamente no lado do cliente (runtime) através da injeção de variáveis CSS globais baseadas no Tailwind CSS v4.1 Não são gerados novos builds individuais para cada inquilino, o que garante a escalabilidade do servidor de hospedagem da Vercel.1

#### **4\. i18n Editável e Internacionalização**

Para permitir que o sistema se expanda futuramente para outros territórios de forma descomplicada, todas as strings de texto, alertas e labels dos aplicativos móveis e dos painéis de controle são centralizadas em dicionários de tradução independentes e editáveis (arquivos de localização estruturados em JSON ou YAML).1  
A plataforma adota o português do Brasil como idioma padrão nativo.1 Se o inquilino desejar traduzir o aplicativo para outra localidade, o sistema lê dinamicamente as strings do arquivo de tradução do tenant correspondente, evitando alterações ou recompilações na base de código compartilhada.1

## **4\. Gestão Descentralizada de Mapas, Rotas e Custos de APIs**

O custo recorrente com as APIs de geolocalização e rotas é um dos fatores mais críticos para o sucesso de uma plataforma SaaS de transporte privado.1 Um único milhão de requisições de mapas do Google Maps pode inviabilizar a lucratividade da empresa provedora do sistema se os custos forem centralizados no Super Admin.1  
Para solucionar este risco, a plataforma adota uma abordagem de **Isolamento de Custo de Mapas**.1

                  \+-----------------------------------+  
                  |      Processamento de Rotas       |  
                  |     (Abstração MapProvider)       |  
                  \+-----------------+-----------------+  
                                    |  
            \+-----------------------+-----------------------+  
            | (Chave Própria Ausente)                       | (Chave Própria Configurada)  
            v                                               v  
\+---------------------------------------+       \+-------------------------------------+  
|        Infraestrutura Padrão          |       |        Consumo Direto Tenant        |  
| \- Tiles: OpenFreeMap (Gratuito) |       | \- Provedor: Google Maps, Mapbox,    |  
| \- Rotas: OSRM Demo / VPS Dedicada     |       |   HERE ou TomTom        |  
| \- Geocode: Photon / Nominatim   |       | \- Faturamento: Conta do Cliente  |  
\+---------------------------------------+       \+-------------------------------------+

### **Abordagem de Custos de Geolocalização**

#### **Integração Centralizada com Provedores Gratuitos e de Baixo Custo**

Por padrão, para novos clientes e para o plano Free, a plataforma oferece renderização nativa em cima do OpenStreetMap (utilizando servidores de tiles gratuitos como OpenFreeMap ou instâncias self-hosted em servidores VPS de baixo custo).1  
Para rotas e estimativas, utiliza-se a API do OSRM (Open Source Routing Machine) 1 e, para geocodificação reversa de endereços, o serviço livre Photon ou instâncias básicas do Nominatim.2

#### **Configuração Descentralizada de Credenciais por Tenant**

O sistema disponibiliza em cada painel de cliente um formulário de configurações de mapas.1 O inquilino que demandar alta fidelidade em endereços e busca semântica robusta pode selecionar o Google Maps, Mapbox ou HERE.1  
Ao fazer isso, o cliente deve obrigatoriamente inserir as suas próprias chaves de API obtidas no painel de desenvolvedor de cada plataforma.1 Desta forma, todas as requisições geradas por aquela operação específica consomem os créditos ou o faturamento direto do respectivo cliente, isentando o Super Admin de qualquer despesa geográfica cruzada.1

#### **Visualização Global do Super Admin no OpenStreetMap**

O mapa geral do painel do Super Admin (que permite visualizar a operação de todas as startups ativas em um único ecossistema analítico) é construído exclusivamente em cima da stack gratuita do OpenStreetMap.1 Isso possibilita que o proprietário do SaaS fiscalize o volume físico de corridas globalmente com custo zero de mapas.1

## **5\. Arquitetura de Pagamentos: Mercado Pago e Preparação para Asaas**

A flexibilidade de métodos de pagamento influencia diretamente a adesão dos usuários de mobilidade.1 A arquitetura foca na implementação ágil e sem atrito do Mercado Pago na versão MVP e estrutura a base de dados para o split avançado do Asaas na fase seguinte.1

### **Mercado Pago Dinâmico no MVP (Sem Split)**

Para o lançamento e testes práticos do sistema, o Mercado Pago será integrado sem divisões automáticas de transação (Split).1 Todas as corridas liquidadas via canais eletrônicos são direcionadas em sua totalidade para a respectiva conta bancária do Tenant Admin cadastrada na plataforma.1

#### **Configuração de Credenciais e Tratamento Dinâmico de Webhooks**

Cada inquilino deve gerar e cadastrar suas chaves de produção (MERCADOPAGO\_ACCESS\_TOKEN e MERCADOPAGO\_PUBLIC\_KEY) diretamente em seu painel de controle administrativo privado.1  
Para processar as notificações de alteração de status de pagamento (webhooks) de forma centralizada e sem a necessidade de expor dezenas de portas no servidor, a plataforma unifica a rota de recebimento do Mercado Pago.9 A URL registrada nos webhooks das aplicações do Mercado Pago de cada tenant carrega um parâmetro identificador no formato de query string 9:  
https://api.suaplataforma.com.br/webhooks/mercadopago?tenant\_id=UUID\_DO\_CLIENTE  
Ao receber uma requisição POST na rota unificada de webhook, o processador central executa os seguintes passos operacionais 9:

1. Extrai o tenant\_id enviado no parâmetro de URL.9  
2. Busca as credenciais criptografadas e o segredo de assinatura (webhook\_secret) daquele respectivo tenant no banco de dados.1  
3. Valida a integridade do payload comparando a assinatura HMAC contida no cabeçalho x-signature utilizando a chave secreta do cliente.9  
4. Consulta o status mais recente do pagamento diretamente na API de origem do Mercado Pago para mitigar possíveis fraudes de payload.28  
5. Atualiza a tabela de pagamentos do banco de dados e notifica em tempo real a transição de estado da corrida para o motorista e o passageiro via conexões do Supabase Realtime.1

#### **Dinheiro e Maquininha Física**

Por padrão, a plataforma aceita meios físicos de pagamento controlados de maneira manual.1 O passageiro solicita a corrida marcando "Dinheiro" ou "Maquininha do Motorista" como modalidade.1  
A liquidação do pagamento ocorre de forma presencial.1 O motorista recebe o montante diretamente e confirma a conclusão da corrida em sua própria tela do aplicativo móvel, liberando as interfaces lógicas.1

### **Preparação Arquitetural para Split de Pagamento via Asaas (Fase 2\)**

Embora a implementação do split de pagamento esteja planejada apenas para uma etapa posterior de desenvolvimento, a estrutura lógica de dados de faturamento e pagamentos já deve contemplar o particionamento do Asaas para evitar refatorações complexas.1  
No modelo BaaS (Banking as a Service) do Asaas, as operações de subcontas exigem o cadastro de dados de pessoas jurídicas atreladas a uma conta parental unificada.24 A tabela de pagamentos é projetada de forma modular para suportar regras de fracionamento de valores no banco de dados centralizado:

SQL  
\-- Estrutura da tabela de controle de pagamentos multi-tenant com suporte a split  
CREATE TABLE payments (  
    id uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    company\_id uuid NOT NULL REFERENCES companies(id),  
    ride\_id uuid NOT NULL REFERENCES rides(id),  
    provider text NOT NULL CHECK (provider IN ('mercadopago', 'asaas', 'cash', 'machine')),  
    provider\_transaction\_id text UNIQUE,  
    amount numeric(10,2) NOT NULL,  
    \-- Taxa de comissão do tenant em cima do motorista (ex: 0.20 \= 20%)  
    commission\_rate numeric(4,3) NOT NULL DEFAULT 0.200,  
    commission\_amount numeric(10,2) NOT NULL, \-- Parte que vai para o dono da operação  
    driver\_amount numeric(10,2) NOT NULL,     \-- Parte que vai para o motorista  
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),  
    webhook\_id text UNIQUE, \-- Controle de idempotência de requisições de pagamento  
    created\_at timestamptz NOT NULL DEFAULT now(),  
    paid\_at timestamptz  
);

\-- Tabela complementar para configurar carteiras de recebimento do Asaas  
CREATE TABLE tenant\_payment\_rules (  
    id uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    company\_id uuid NOT NULL REFERENCES companies(id) UNIQUE,  
    asaas\_access\_token text, \-- Chave de API de faturamento do cliente  
    asaas\_wallet\_id text,    \-- Identificador da carteira matriz da operação  
    active\_split boolean DEFAULT false  
);

No ecossistema do Asaas, a divisão de comissões (split) é realizada exclusivamente através do consumo da API de faturamento e atua de maneira síncrona diretamente sobre o valor líquido recebido da transação (deduzida a taxa transacional cobrada pelo processamento do boleto, cartão de crédito ou PIX).10 A reversão da cobrança por estorno (chargeback) automaticamente aciona o estorno proporcional dos splits concedidos a todas as subcontas vinculadas.10

## **6\. Mecânica e Ciclo de Vida da Corrida, Precificação e Avaliações**

O ciclo de vida de uma corrida opera de forma síncrona e persistente sob uma máquina de estados robusta baseada no banco de dados.1

### **Mecânica de Precificação Flexível por Operação**

A precificação segue a parametrização definida nas configurações de categoria de cada inquilino.1 O Tenant Admin tem controle total para habilitar ou desabilitar cada elemento que compõe o preço final.1 A fórmula geral de faturamento baseia-se na somatória das tarifas:  
![][image2]  
Onde ![][image3] representa a distância estimada em quilômetros via OSRM e ![][image4] a duração prevista da rota em minutos.1 Se o tenant optar por cobrar exclusivamente pela distância, a variável de tempo é desativada nas preferências do painel do cliente, zerando o fator temporal na equação.1

#### **Estimativa Prévia e Motor de Recálculo Final**

O passageiro recebe uma estimativa calculada no momento de solicitar o veículo, com base no trajeto previsto no mapa.1 Se o trajeto real realizado sofrer alterações substanciais devido a desvios, engarrafamentos ou paradas não planejadas, o sistema executa um recálculo automático ao final da corrida.1  
A regra operacional determina que se a distância real percorrida ultrapassar ![][image5] da estimativa inicial, ou se a viagem demorar mais de 5 minutos adicionais em relação ao cronograma inicial, a corrida é faturada com base nas métricas reais de tempo e distância calculadas pelo GPS do motorista e consolidadas no encerramento da viagem.1

### **Mecanismos de Cobrança e Notificações de Pagamento**

* **Cobrança em Cartão de Crédito ou PIX:** O pagamento é liquidado ao final da corrida.1 O sistema dispara a cobrança via API do Mercado Pago utilizando os cartões tokenizados ou gera o PIX dinâmico.1 O retorno automático de aprovação recebido via webhook atualiza a corrida e envia uma notificação push simultânea para os PWAs do motorista e do passageiro com o alerta "Corrida Paga", finalizando a operação logicamente no sistema.1  
* **Cobrança em Dinheiro ou Maquininha:** O motorista é o responsável por certificar o recebimento e tocar no botão "Encerrar Corrida" no aplicativo driver-pwa para declarar que a transação física foi resolvida.1

#### **Fluxo de Mitigação para Esquecimento do Encerramento de Corrida**

Se o motorista esquecer de encerrar a corrida manualmente após a descida do passageiro, a plataforma implementa uma rotina de segurança lógica para evitar travamentos e inconsistências operacionais 1:

1. O sistema monitora a inatividade física do veículo: se a posição do GPS do motorista não se alterar de forma significativa nos últimos 10 minutos após o destino previsto ter sido alcançado, e o motorista estiver parado fora do trajeto, a plataforma gera uma notificação push alertando o motorista para encerrar a viagem pendente.  
2. Caso a viagem permaneça aberta, **o motorista não é bloqueado de receber novas corridas**.1 A plataforma permite que ele continue aceitando novas chamadas concorrentes normalmente.1  
3. Simultaneamente, o sistema gera uma tarefa em background (cron job interno no Supabase) que finaliza automaticamente a corrida inativa sob o rótulo de "Auto-Encerramento por Inatividade", enviando o trajeto real finalizado para o log administrativo do Tenant Admin para análise de desvios operacionais.

### **Fluxo de Corridas Agendadas com Alocação Manual**

As corridas agendadas seguem um fluxo operacional focado no gerenciamento direto da frota.1 O passageiro insere o horário futuro em que deseja realizar o trajeto.1  
Diferente do fluxo tradicional de despacho instantâneo, **o sistema não envia chamadas de busca automatizadas no horário marcado**.1 A corrida agendada é direcionada de forma exclusiva para o painel de despacho do Tenant Admin.1 O proprietário da operação visualiza a lista completa de reservas futuras e atribui de forma puramente manual qual motorista específico de sua frota será alocado para realizar o atendimento.1

### **Avaliação de Reputação Unificada**

A conclusão de toda corrida direciona ambos os usuários para a tela de classificação simplificada.1 A pontuação é baseada em uma escala estrita de 1 a 5 estrelas.1  
O sistema não possui entrada para comentários ou caixas de texto abertas, eliminando o estresse operacional de processamento de texto e moderação de termos.1 A nota é consolidada no perfil público do motorista e do passageiro de forma numérica simples.1

### **Chat de Texto Integrado**

* **Texto Puro:** Canal de mensagens instantâneas bidirecional disponível exclusivamente durante a realização da viagem ativa.1  
* **Encerramento Automático:** Assim que a corrida é declarada finalizada pelo sistema, o canal de chat é fechado e impossibilitado de receber novos pacotes de dados.1  
* **Visualização de Logs Administrativos:** Todas as interações de chat são persistidas no banco de dados.1 O Tenant Admin tem acesso para ler o histórico completo de conversas em seu painel analítico para fins de resolução de disputas e suporte ao usuário, porém é totalmente impedido de interferir ou enviar mensagens na conversa enquanto ela estiver ocorrendo em tempo real.1

## **7\. Cerca Virtual e Mecânica de Bloqueio por Geofencing**

O desenho e o controle espacial de áreas de atuação são cruciais para a expansão e o controle regulatório local das operações de mobilidade.1 O sistema provê ferramentas de Geofencing integradas que permitem definir polígonos ilimitados sobre o mapa.1

\+--------------------------------------------------------------------------+  
|                        Visualização do Mapa                              |  
\+------------------------------------+-------------------------------------+  
                                     |  
                                     v  
\+--------------------------------------------------------------------------+  
|  Zona Poligonal Desenclada (Geofence Ativa)                              |  
|  \- Área interna: Operação normal permitida                               |  
|  \- Área externa: Operações bloqueadas                                    |  
\+------------------------------------+-------------------------------------+  
                                     |  
                  \+------------------+------------------+  
                  |                                     |  
                  v                                     v  
\+----------------------------------+ \+-------------------------------------+  
| Fluxo do Passageiro              | | Fluxo do Motorista                  |  
| \- Origem fora da Geofence?       | | \- Fora do perímetro ativo?          |  
|   Bloquear solicitação           | |   Impedir botão "Ficar Online"      |  
|   "Zona não habilitada"    | |   "Zona não habilitada"       |  
\+----------------------------------+ \+-------------------------------------+

### **Regras de Bloqueio Operacional por Geofence**

1. **Restrição do Passageiro:** Quando o passageiro abre o passenger-pwa para pedir uma corrida, o sistema valida suas coordenadas geográficas de origem utilizando a extensão PostGIS do PostgreSQL do Supabase.1 Se o ponto de origem estiver fora do perímetro da cerca poligonal desenhada pelo tenant, a interface bloqueia imediatamente o botão de solicitação e emite um alerta explícito na tela do usuário: *"Zona de operação não habilitada. Não operamos nesta região no momento."*.1  
2. **Restrição do Motorista:** O motorista só é autorizado a transitar para o estado de "Ficar Online" caso o GPS do seu dispositivo envie uma coordenada válida inserida dentro dos limites de uma das cercas virtuais operacionais ativas do tenant.1 Se o motorista se deslocar para fora do perímetro da zona desenhada enquanto estiver online, o sistema dispara uma rotina de segurança que altera automaticamente seu estado para "Offline" e envia uma notificação push avisando que ele se encontra fora do território habilitado para operação.1

### **Cidades Ilimitadas no Painel do Tenant**

Como diferencial competitivo, a plataforma não possui bloqueios rígidos baseados em limites políticos de municípios.1 O Tenant Admin pode expandir suas operações para quantas cidades desejar através da criação de novas cercas virtuais poligonais no painel administrativo, mantendo o controle centralizado do faturamento de maneira independente.1

## **8\. Central de Chamados e Suporte ao Cliente**

Para estruturar o ecossistema de ouvidoria e suporte técnico interno da plataforma sem recorrer a ferramentas externas pagas, o sistema de banco de dados centraliza um fluxo de tickets com estados imutáveis (Aberto, Em andamento e Fechado).1

### **Hierarquia e Escopo dos Chamados Operados na Plataforma**

* **Chamados de Nível SaaS (Tenant Admin ![][image6] Super Admin):** Canal exclusivo onde o cliente contratante abre chamados direcionados ao dono da infraestrutura SaaS para suporte sobre instabilidades do painel, faturamento de planos de add-ons ou requisição de manutenção técnica.1  
* **Chamados de Nível Motorista (Motorista ![][image6] Tenant Admin):** Canal onde os motoristas vinculados a uma operação de transporte reportam problemas sobre aprovação de documentação de veículos, bloqueios na plataforma, problemas com transações financeiras locais ou dúvidas administrativas.1  
* **Chamados de Nível Passageiro (Passageiro ![][image6] Tenant Admin):** Canal para suporte direto ao cliente final da operação móvel, cobrindo reclamações de mau comportamento de motoristas, disputas de valores de corrida ou registro de objetos esquecidos no veículo.1

### **Ciclo de Estados dos Chamados**

  \+--------+      Iniciar       \+---------------+  
  | Cliente+-------------------\>|    Aberto     |  
  \+--------+                    \+-------+-------+  
                                        |  
                                        v  
  \+--------+      Processar     \+---------------+  
  | Suporte+-------------------\>| Em Andamento  |  
  \+--------+                    \+-------+-------+  
                                        |  
                                        v  
  \+--------+      Resolver      \+---------------+  
  | Suporte+-------------------\>|    Fechado    |  
  \+--------+                    \+---------------+

O histórico e as interações de cada chamado contam com logs de auditoria imutáveis, garantindo transparência e rastreabilidade jurídica em caso de disputas nos serviços prestados.1

## **9\. Arquitetura de i18n Editável e Internacionalização**

Para que a plataforma mantenha a agilidade operacional focada prioritariamente no Brasil neste momento, mas garanta facilidade de expansão e suporte a outros países no futuro de forma nativa 1, toda a interface visual e lógica de mensagens do sistema é desenvolvida sobre um ecossistema de internacionalização baseada em dicionários estruturados.1

### **Estrutura dos Arquivos de Localização**

Todas as strings de texto, títulos de botões, mensagens de erro e respostas de APIs residem em arquivos independentes dentro do diretório /locales de cada pacote e aplicação do monorepo.1

JSON  
{  
  "api": {  
    "geofence": {  
      "outside\_zone\_alert": "Zona não habilitada nesta área."  
    },  
    "ride": {  
      "not\_authorized": "Não autorizado a solicitar corridas fora do perímetro de atendimento."  
    }  
  },  
  "driver\_pwa": {  
    "onboarding": {  
      "welcome": "Bem-vindo à nossa plataforma de motoristas\!"  
    },  
    "map": {  
      "stay\_online": "Ficar Online"  
    }  
  }  
}

O Next.js lê dinamicamente as variáveis de idioma associadas ao cabeçalho Accept-Language da requisição HTTP ou lê as configurações de preferência do tenant gravadas no banco de dados.30 Se no futuro a plataforma Mobiler for revendida para um cliente em Portugal ou na América Latina, basta realizar a cópia e tradução direta do arquivo JSON local correspondente àquela operação sem tocar em uma única linha de código lógico da aplicação, eliminando riscos de bugs induzidos.1

#### **Referências citadas**

1. arquitetura-saas-mobilidade (1).pdf  
2. PWA iOS Limitations and Safari Support \[2026\] \- MagicBell, acessado em junho 30, 2026, [https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)  
3. PWA vs Native App: When to Build Progressive Web Apps \[2026\] \- MagicBell, acessado em junho 30, 2026, [https://www.magicbell.com/blog/pwa-vs-native-app-when-to-build-installable-progressive-web-app](https://www.magicbell.com/blog/pwa-vs-native-app-when-to-build-installable-progressive-web-app)  
4. Solution for constant background geolocation and reliable notification? : r/PWA \- Reddit, acessado em junho 30, 2026, [https://www.reddit.com/r/PWA/comments/1udmzg1/solution\_for\_constant\_background\_geolocation\_and/](https://www.reddit.com/r/PWA/comments/1udmzg1/solution_for_constant_background_geolocation_and/)  
5. Wake Lock API: Browser Support, Features, Use Cases | TestMu AI (Formerly LambdaTest), acessado em junho 30, 2026, [https://www.testmuai.com/learning-hub/wake-lock-api-browser-support/](https://www.testmuai.com/learning-hub/wake-lock-api-browser-support/)  
6. Screen Wake Lock PWA Demo \- Progressier, acessado em junho 30, 2026, [https://progressier.com/pwa-capabilities/screen-wake-lock](https://progressier.com/pwa-capabilities/screen-wake-lock)  
7. Understanding the benefits of using Capacitorjs over a normal PWA for building a hybrid, acessado em junho 30, 2026, [https://www.reddit.com/r/ionic/comments/yv739h/understanding\_the\_benefits\_of\_using\_capacitorjs/](https://www.reddit.com/r/ionic/comments/yv739h/understanding_the_benefits_of_using_capacitorjs/)  
8. Are the Mercado Pago developers okay with this? : r/devsarg \- Reddit, acessado em junho 30, 2026, [https://www.reddit.com/r/devsarg/comments/1rax412/los\_desarrolladores\_de\_mercado\_pago\_estan\_de/?tl=en](https://www.reddit.com/r/devsarg/comments/1rax412/los_desarrolladores_de_mercado_pago_estan_de/?tl=en)  
9. Webhooks \- Documentación \- Mercado Pago Developers, acessado em junho 30, 2026, [https://www.mercadopago.com.mx/developers/en/docs/your-integrations/notifications/webhooks](https://www.mercadopago.com.mx/developers/en/docs/your-integrations/notifications/webhooks)  
10. Overview \- Asaas \- Documentação API, acessado em junho 30, 2026, [https://docs.asaas.com/docs/payment-split-overview](https://docs.asaas.com/docs/payment-split-overview)  
11. Can PWAs send Push Notifications? How PWAs and Native Apps Compare, acessado em junho 30, 2026, [https://flywheel.so/post/can-pwas-send-push-notifications](https://flywheel.so/post/can-pwas-send-push-notifications)  
12. 4 Essential PWA Strategies for Enhanced iOS Performance \- MagicBell, acessado em junho 30, 2026, [https://www.magicbell.com/blog/essential-pwa-strategies-for-enhanced-ios-performance](https://www.magicbell.com/blog/essential-pwa-strategies-for-enhanced-ios-performance)  
13. Apple's WebKit Rules Reportedly Costs iOS Users Almost 30% Browser Performance, acessado em junho 30, 2026, [https://www.reddit.com/r/apple/comments/1u8ep4e/apples\_webkit\_rules\_reportedly\_costs\_ios\_users/](https://www.reddit.com/r/apple/comments/1u8ep4e/apples_webkit_rules_reportedly_costs_ios_users/)  
14. Can PWAs Access My Phone's Camera And GPS Like Regular Apps?, acessado em junho 30, 2026, [https://weareaffective.com/learning-centre/can-pwas-access-my-phones-camera-and-gps-like-regular-apps](https://weareaffective.com/learning-centre/can-pwas-access-my-phones-camera-and-gps-like-regular-apps)  
15. Screen Wake Lock \- What PWA Can Do Today, acessado em junho 30, 2026, [https://whatpwacando.today/wake-lock/](https://whatpwacando.today/wake-lock/)  
16. Geolocation API \- PWA Demo \- Progressier, acessado em junho 30, 2026, [https://progressier.com/pwa-capabilities/geolocation](https://progressier.com/pwa-capabilities/geolocation)  
17. Building audio app for iOS. Does background audio work on PWA or is native the only option? \- Reddit, acessado em junho 30, 2026, [https://www.reddit.com/r/PWA/comments/1spgkcn/building\_audio\_app\_for\_ios\_does\_background\_audio/](https://www.reddit.com/r/PWA/comments/1spgkcn/building_audio_app_for_ios_does_background_audio/)  
18. Did iOS 26 break background audio playback? : r/PWA \- Reddit, acessado em junho 30, 2026, [https://www.reddit.com/r/PWA/comments/1l8hm1r/did\_ios\_26\_break\_background\_audio\_playback/](https://www.reddit.com/r/PWA/comments/1l8hm1r/did_ios_26_break_background_audio_playback/)  
19. Configuring your app for media playback | Apple Developer Documentation, acessado em junho 30, 2026, [https://developer.apple.com/documentation/avfoundation/configuring-your-app-for-media-playback](https://developer.apple.com/documentation/avfoundation/configuring-your-app-for-media-playback)  
20. Cap-go/capacitor-background-geolocation: Capacitor plugin that sends you accurate geolocation updates, even while the app is in the background. \- GitHub, acessado em junho 30, 2026, [https://github.com/Cap-go/capacitor-background-geolocation](https://github.com/Cap-go/capacitor-background-geolocation)  
21. Efficient Background Geolocation in Ionic Apps \- Prospera Soft, acessado em junho 30, 2026, [https://prosperasoft.com/blog/mobile-app-development/ionic/ionic-background-geolocation-battery/](https://prosperasoft.com/blog/mobile-app-development/ionic/ionic-background-geolocation-battery/)  
22. Platforms Starter Kit \- Vercel, acessado em junho 30, 2026, [https://vercel.com/templates/next.js/platforms-starter-kit](https://vercel.com/templates/next.js/platforms-starter-kit)  
23. Subdomain-Based Routing in Next.js: A Complete Guide for Multi-Tenant Applications, acessado em junho 30, 2026, [https://medium.com/@sheharyarishfaq/subdomain-based-routing-in-next-js-a-complete-guide-for-multi-tenant-applications-1576244e799a](https://medium.com/@sheharyarishfaq/subdomain-based-routing-in-next-js-a-complete-guide-for-multi-tenant-applications-1576244e799a)  
24. Create subaccount \- Asaas \- Documentação API, acessado em junho 30, 2026, [https://docs.asaas.com/reference/create-subaccount](https://docs.asaas.com/reference/create-subaccount)  
25. CVE-2026-20643, the WebKit Navigation API bug that broke a same-origin assumption, acessado em junho 30, 2026, [https://www.penligent.ai/hackinglabs/cve-2026-20643-the-webkit-navigation-api-bug-that-broke-a-same-origin-assumption/](https://www.penligent.ai/hackinglabs/cve-2026-20643-the-webkit-navigation-api-bug-that-broke-a-same-origin-assumption/)  
26. Set up payment methods \- Documentación \- Mercado Pago Developers, acessado em junho 30, 2026, [https://www.mercadopago.com.br/developers/en/docs/linx/configure-payment-method](https://www.mercadopago.com.br/developers/en/docs/linx/configure-payment-method)  
27. Activate production credentials \- Documentación \- Mercado Pago Developers, acessado em junho 30, 2026, [https://www.mercadopago.com.co/developers/en/docs/credentials](https://www.mercadopago.com.co/developers/en/docs/credentials)  
28. Handling Webhooks \- Laravel MercadoPago, acessado em junho 30, 2026, [https://fitodac-laravel-mercadopago.mintlify.app/guides/handling-webhooks](https://fitodac-laravel-mercadopago.mintlify.app/guides/handling-webhooks)  
29. Configure notifications \- Documentación \- Mercado Pago Developers, acessado em junho 30, 2026, [https://www.mercadopago.com.ar/developers/en/docs/checkout-api-orders/notifications](https://www.mercadopago.com.ar/developers/en/docs/checkout-api-orders/notifications)  
30. Multi-Tenant Platform Concepts \- Vercel, acessado em junho 30, 2026, [https://vercel.com/docs/platforms/multi-tenant-platforms/concepts](https://vercel.com/docs/platforms/multi-tenant-platforms/concepts)  
31. Asaas BaaS, acessado em junho 30, 2026, [https://docs.asaas.com/docs/about-baas](https://docs.asaas.com/docs/about-baas)  
32. Split \- Asaas \- Documentação API, acessado em junho 30, 2026, [https://docs.asaas.com/docs/split](https://docs.asaas.com/docs/split)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAZCAYAAABzVH1EAAACW0lEQVR4Xu2WPYxNURDHR0RCSKwQGyKxK0ujUGAL0ZEVjYZCwRaaVUt8RKERQSSyFIho2AqFaqNRqGkURCJR2OgUEkGC+Pj/MvfkzZu9b3ffy+4Wcv/JL/edOXPPnblzztxn1qhRo27UJ/aKrXkiaKnYJPaY+88k5q+Iu4kbYqC65jn8Z1u3o1aIq+KleCg+i+NiSXSShsQr8UCMiRfm9y2LTkEkvV4cMF/zlzgh+s3v4coYO/P44c99XWudeCM+iR3B/ldMiuXV+JD4YV6xqEvirXlQnbRBfBDfxM40xxg78/j1rJIIgR8M9rz4zcqWAzkr/oj9yR61KIkgtsw+a98ilJuttkasFM+sPhAS4SWw1Tqpl0QGrP4MnbbWLpmTCI4g0SrxXHw0P+hRJZHiW6eSCJV7Yu2BMcaeEyHBKTFa2TeK2+JY8JlV28VTsboal0Tyw1A3iVBl/I4EGGPPa3MWb1mr4XBGf1vnxjJNBM82Kkmg+Uqkm63FmTtZ/d4s3pk3lTmJbO9URJUz8sXaOxsqiZxK9qheEikipkfm7Xk4zdWKG66JC9VvqnDdvKuhe1YfyEJ2LbbVGfP1uTK+bx5brXCgG5yz1sdoi5gwrwY6ar5Hc8C0ZZrAYLJH9ZoIFaASVKScjXhupumw+G4eEJ0CvppXoYgv7mtx0VoLrTX/uo8HW51KIjxjd5pjjD0nUp7H2eCMIJKhIrXqF+/N93kmH+Bd5sleNq/QpHhs7Y0hqiSQ1y2V4ZrnSkL852LMCy0v96c4b/MkttqIeevcZjNXolGjRo0a/d/6B1HLrjGv6+jGAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAbCAYAAACAyoQSAAABqElEQVR4Xu2UPyiFYRTGH6H8TaKwEIuUQflTYlEGBoqJpGwMJiWRkmQzyZ/yJxlkYBHKJMpoMaCURcokCwYGnqfzfd3vvrfIvfeb3Kd+wz3v+53zvuc57wVS+k/KI/fkgXQ7a6EpnWySN1LvrIWqfXJNit2FMPVJht1gslVNtmA+rpB30hi1I8nqJY+knaSRIYTc2ibyQiYCsTKyAztA0pVNDskTqQrEW5GYn81uICg9Bz2LY5IViKtgIn6OuIGgusgXmQrEMmDPxfUzk5SQIkS3XX8ksqOA5Hj7glbFqBNWVIPkS4lvYcnWYW2vIyewQZsly7Dk+m6aVJA5MknGySVZg+WPUSVsan3/lGgBdpBaWPJ8WMEBb486cAGzZoP0w26u2/Z4e368qeQ/l21yRgZhyY5gk11DnsmNt35O7mC31rcf5JXsklKYfi0qaYh0Un+YdHK1V1J7Nd3y31UuKYStncIKayZUVLnaIlv/JiVRMnnmD1ALaSDzMIukctjb1mE1mDrMmLcWl9S2A7JIRmHDIv9XyR7pI0uI+H5FZkiH9zullFKKT9/ZhkTO16ZwAgAAAABJRU5ErkJggg==>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAbCAYAAABiFp9rAAABaUlEQVR4Xu3UzStFQRjH8UdeIhZEeVuwoSwkKS9loywo7EiRP8DKS2LFxoZ/QEm5lCjKgqWFKCnKn8BGslVWJN+nZxZj7ourZuf86lNnzsy9M2eeOUckSZIsqcEMysOO2FnGGzrCjphpxBN2UfCzK06GsY1TfOHetcf9QTFSiSbs4x2DqEeFPyhWinCCO1QFfVETqz66OznTjw9MhR1/TFd4I4wea61PpoGlYjXzV6tPXY1asVoWO3qIsiZTfeYxJHYiz9GDPSyiBBsYQRvO0IclPIpNpr9Li67oEgdiK+1GCmViR123VaN/eotOXKDF3df+dneti8mZObzgEMeoc/c/8SC2kGt3rRNtib1zz2JPqdum+XUijdZA990/da+SXrdCsW9hM2bFJpt0fTqR1nTAtfPODaa99hh6sSlWW82E2GHS7IjVecG1847W5QqrWBH7sjeILWBd7HU4QqsbP4o1sYOUJMl/yTfFxzmPNnAGugAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAZCAYAAAB3oa15AAACQElEQVR4Xu2WMUhVURjH/1GBSRBqJJaSQ5tDgxg0BA46OBiRIE0uDkGCg6JCg7hJWxAt1dIgKgXiqC0vaIlEa4jACAyqvcHBIfX/95yj537vPt/r3RcY3B/8eO9+59z7znfOd859QE7Of8s4/UY/0C7TFjNAZ2ywHG02kEKj19JCz5rYadpsYgV6gV6l63SaNkXt5+gD36Y+ZdGPdtDncDOTxil6mY7Q37Q/2XzAS/qHfqVz9CPdgZvxwHn6MLpWmxJYpht0jb6ln+BW4K/QAL7boEED3/OfFt0/BLcSmlElbVHbVHSt58TXl+hrVDjzllokkBaPaUByBSZon/+uhB+hipkP1CoB7aM7tBNuD1gKcHtAsz3vP0UvfYLifVQxtUhA9f+Y3oOr63e0Ne5EZulPuklv+Zj6LKHK0glkTeApksuvctFRuQq3eUtxBi7pcK9WQJv7C30TOlVC1gTS0DN3aY9tiLiNZOlo8Iv++gbcsVoRWRJQrauW60xcz1T/MRMP2NK5SD/jqL829nX/vSxZEhj2cW1KlUTguARs6Qht/G0kn29/qyRZErjv45M4Ov81QJ3pepnd9LEYWzqi6gRUAgv0h20wDMIN9K6J603+Cu54DFyjv+gzFB+NtnQCV+gW3IQEjvu/dJixBhUbvx11ghRS+kjFA0pK9Tvq3YKblDgpkVY6Aa2e2l7A9WtH8f3/FP2F0JLrRdaO9L8T3XCDjPdKjAasvbRC35u2E4EGXmrwMfVIf5Pn5OTknAD2AZGqfUeKYHONAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAZCAYAAADe1WXtAAAAcElEQVR4XmNgGAWjgBTACsTc6IKUAk0gng7ELOgSlAAOIJ4DxDroEpQCWyDuZ4AEBdUAIxCXAnEdAw6DQQqsgDiERBwKxDuB+BQQmzNAzIEDmhhKDiDofXIA1SOKJklKCYgnM1A58dMkm46CUYAHAADZRxNI29JbXQAAAABJRU5ErkJggg==>