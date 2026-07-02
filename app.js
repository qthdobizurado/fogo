"use strict";

    const INPE_BASE = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/10min/";
    const INPE_DIARIO_BASE = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/";
    const INPE_EVENTOS_ATIVOS_KML = "https://dataserver-coids.inpe.br/queimadas/queimadas/eventos/ativos/eventos_ativos.kml";
    const INPE_EVENTOS_OBSERVACAO_KML = "https://dataserver-coids.inpe.br/queimadas/queimadas/eventos/observacao/eventos_observacao.kml";
    const GOIAS_GEOJSON_URL = "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";
    const GOIAS_MUNICIPIOS_IBGE_URL = "https://servicodados.ibge.gov.br/api/v3/malhas/estados/52?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio";
    const GOIAS_MUNICIPIOS_NOMES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/52/municipios";
    const GOIAS_MUNICIPIOS_FALLBACK_URL = "https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-52-mun.json";
    const GOIAS_BOUNDS = [[-19.75, -53.35], [-12.15, -45.65]];
    const INTENSIDADE_FRP_BAIXA_MAX = 5;
    const INTENSIDADE_FRP_MEDIA_MAX = 20;

    const map = L.map("map", { preferCanvas: true, zoomControl: false, maxZoom: 19 }).setView([-16.3, -49.95], 7);

    if (map.attributionControl) {
      map.attributionControl.setPrefix("© 2026 - Desenvolvido por BM Fernandes 04032");
    }
const sateliteImagem = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      maxNativeZoom: 17,
      attribution: ""
    });

    const sateliteRelevoSombreado = L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      maxNativeZoom: 13,
      opacity: 0.32,
      attribution: ""
    });

    const sateliteRodovias = L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      maxNativeZoom: 17,
      attribution: ""
    });

    const sateliteNomes = L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      maxNativeZoom: 17,
      attribution: ""
    });

    const baseSateliteComNomes = L.layerGroup([sateliteImagem, sateliteRelevoSombreado, sateliteRodovias, sateliteNomes]).addTo(map);

    map.createPane("paneEventos");
    map.getPane("paneEventos").style.zIndex = 620;
    map.getPane("paneEventos").style.pointerEvents = "auto";

    map.createPane("paneFirms");
    map.getPane("paneFirms").style.zIndex = 640;

    map.createPane("paneFocos");
    map.getPane("paneFocos").style.zIndex = 760;
    map.getPane("paneFocos").style.pointerEvents = "auto";

    map.createPane("paneUserLocation");
    map.getPane("paneUserLocation").style.zIndex = 880;
    map.getPane("paneUserLocation").style.pointerEvents = "auto";

    map.createPane("paneEstradas");
    map.getPane("paneEstradas").style.zIndex = 610;
    map.getPane("paneEstradas").style.pointerEvents = "auto";

    map.createPane("paneRota");
    map.getPane("paneRota").style.zIndex = 660;
    map.getPane("paneRota").style.pointerEvents = "auto";

    if (map.getPane("popupPane")) {
      map.getPane("popupPane").style.zIndex = 1500;
      map.getPane("popupPane").style.pointerEvents = "auto";
    }
    if (map.getPane("tooltipPane")) {
      map.getPane("tooltipPane").style.zIndex = 1290;
    }

    const layerLimite = L.layerGroup().addTo(map);
    const layerMunicipiosDivisas = L.layerGroup().addTo(map);
    const layerEstradasDestaque = L.layerGroup().addTo(map);
    const layerAceiroManualTemp = L.layerGroup().addTo(map);
    const layerRotaPercorrida = L.layerGroup().addTo(map);
    const layerRotaAcesso = L.layerGroup().addTo(map);
    const layerNavegacaoInterna = L.layerGroup().addTo(map);
    const layerAlvoOperacional = L.layerGroup().addTo(map);
    const layerAreaAcao = L.layerGroup().addTo(map);
    const layerPontosOperacionais = L.layerGroup().addTo(map);
    const layerEventosAtivos = L.layerGroup();
    const layerEventosObservacao = L.layerGroup();
    const layerFirms = L.layerGroup();
    const layerFocos = L.layerGroup().addTo(map);
    const layerMunicipioSelecionado = L.layerGroup().addTo(map);
    const layerUser = L.layerGroup().addTo(map);
let goiasGeometry = null;
    let municipiosGoias = [];
    let municipiosCarregados = false;
    let focosAtuais = [];
    let marcadorPorId = new Map();
    let focosClicaveisNoMapa = [];
    let eventosCache = {
      ativos: null,
      observacao: null
    };
    let eventosAtualizacaoMeta = {
      ativo: { baixadoEm: 0, lastModified: "", offline: false, erroEm: 0, erro: "" },
      observacao: { baixadoEm: 0, lastModified: "", offline: false, erroEm: 0, erro: "" }
    };
    let ultimoEstadoSalvoEm = 0;
    let userLocated = false;
    let userInsideGoias = false;
    let ultimaLocalizacao = null;
    let gpsCampoAtivo = false;
    let seguirGpsAtivo = true;
    let alvoOperacionalAtual = null;
    let rotaAcessoAtual = null;
    let navegacaoInternaAtiva = false;
    let modoMarcacaoOperacional = null;
    let pontosOperacionais = [];
    let autoSaveOfflineTimer = null;
    let estadoOfflineCarregadoNestaSessao = false;
    let atualizacaoEmAndamento = false;
    let atualizacaoAutomaticaPendente = false;
    let ultimaInteracaoUsuario = Date.now();
    const TEMPO_ESPERA_INTERACAO_AUTO_MS = 20000;
    const PONTOS_OPERACIONAIS_KEY = "queimadas_goias_pontos_operacionais_v1";
    let goiasViewBounds = null;

    const els = {
      periodo: document.getElementById("periodo"),
      municipio: document.getElementById("municipio"),
      usarEntorno: document.getElementById("usarEntorno"),
      raioEntorno: document.getElementById("raioEntorno"),
      totalFocos: document.getElementById("totalFocos"),
      csvsLidos: document.getElementById("csvsLidos"),
      totalRecentes: document.getElementById("totalRecentes"),
      totalAnteriores: document.getElementById("totalAnteriores"),
      status: document.getElementById("status"),
      loading: document.getElementById("loading"),
      busca: document.getElementById("busca"),
      listaFocos: document.getElementById("listaFocos"),
      eventosStatus: document.getElementById("eventosStatus"),
      extrasStatus: document.getElementById("extrasStatus"),
      eventosAtivosCount: document.getElementById("eventosAtivosCount"),
      eventosObservacaoCount: document.getElementById("eventosObservacaoCount"),
      eventosResumoMapa: document.getElementById("eventosResumoMapa"),
      rotaStatus: document.getElementById("rotaStatus"),
      operacaoAlvoNome: document.getElementById("operacaoAlvoNome"),
      operacaoDistancia: document.getElementById("operacaoDistancia"),
      operacaoRumo: document.getElementById("operacaoRumo"),
      operacaoGps: document.getElementById("operacaoGps"),
      painelFocoOpcoes: document.getElementById("painelFocoOpcoes"),
      painelFocoConteudo: document.getElementById("painelFocoConteudo"),
      painelBaseOpcoes: document.getElementById("painelBaseOpcoes"),
      painelBaseConteudo: document.getElementById("painelBaseConteudo"),
      painelCercoManualOpcoes: document.getElementById("painelCercoManualOpcoes"),
      painelCercoManualConteudo: document.getElementById("painelCercoManualConteudo"),
      painelEventoOpcoes: document.getElementById("painelEventoOpcoes"),
      painelEventoConteudo: document.getElementById("painelEventoConteudo")
    };

    function setStatus(texto, tipo = "") {
      els.status.innerHTML = `<span class="${tipo}">${escapeHtml(texto)}</span>`;
    }

    function registrarLogPopupFoco() {
    }

    function registrarInteracaoUsuario() {
      ultimaInteracaoUsuario = Date.now();
    }

    function painelVisivel(el) {
      return !!(el && el.classList && !el.classList.contains("hidden-ui"));
    }

    function interfaceEmUsoAgora() {
      const mexeuAgora = (Date.now() - ultimaInteracaoUsuario) < TEMPO_ESPERA_INTERACAO_AUTO_MS;
      const popupAberto = !!(map && map._popup);
      const painelAberto = painelVisivel(els.painelFocoOpcoes) ||
        painelVisivel(els.painelEventoOpcoes) ||
        painelVisivel(els.painelBaseOpcoes) ||
        painelVisivel(els.painelCercoManualOpcoes);

      return mexeuAgora || popupAberto || painelAberto || !!aceiroManualAtivo || !!modoMarcacaoOperacional;
    }

    function agendarAtualizacaoAutomaticaQuandoLivre(delayMs = 20000) {
      if (atualizacaoAutomaticaPendente) return;
      atualizacaoAutomaticaPendente = true;
      setTimeout(() => {
        atualizacaoAutomaticaPendente = false;
        atualizarAutomaticamente();
      }, delayMs);
    }

    function atualizarAutomaticamente() {
      if (navigator.onLine === false) return;
      if (atualizacaoEmAndamento) {
        agendarAtualizacaoAutomaticaQuandoLivre(20000);
        return;
      }
      if (interfaceEmUsoAgora()) {
        agendarAtualizacaoAutomaticaQuandoLivre(TEMPO_ESPERA_INTERACAO_AUTO_MS);
        return;
      }
      atualizar({ origem: "auto", silencioso: true }).catch((err) => {
        console.warn("Atualização automática falhou; mantendo dados atuais:", err);
      });
    }

    function abrirPainelEventoOpcoes(htmlConteudo) {
      if (!els.painelEventoOpcoes || !els.painelEventoConteudo) return false;

      if (typeof fecharPainelFocoOpcoes === "function") fecharPainelFocoOpcoes();
      if (typeof fecharPainelBaseOpcoes === "function") fecharPainelBaseOpcoes();
      if (typeof fecharPainelCercoManualOpcoes === "function") fecharPainelCercoManualOpcoes();

      els.painelEventoConteudo.innerHTML = htmlConteudo || "<strong>Evento</strong><br>Sem informações disponíveis.";
      els.painelEventoOpcoes.classList.remove("hidden-ui");

      const dataOffline = ultimoEstadoSalvoEm ? new Date(ultimoEstadoSalvoEm).toLocaleString("pt-BR") : "data não registrada";
      if (estadoOfflineCarregadoNestaSessao || navigator.onLine === false) {
        setStatus(`Informações do evento abertas em modo offline. Último estado salvo: ${dataOffline}.`, "ok");
      } else {
        setStatus("Informações do evento abertas com dados carregados da internet.", "ok");
      }
      return true;
    }

    function fecharPainelEventoOpcoes() {
      if (els.painelEventoOpcoes) {
        els.painelEventoOpcoes.classList.add("hidden-ui");
      }
    }


    function abrirPainelBaseOpcoes(htmlConteudo) {
      if (!els.painelBaseOpcoes || !els.painelBaseConteudo) return false;
      fecharPainelEventoOpcoes();
      fecharPainelFocoOpcoes();
      els.painelBaseConteudo.innerHTML = htmlConteudo;
      els.painelBaseOpcoes.classList.remove("hidden-ui");
      return true;
    }

    function fecharPainelBaseOpcoes() {
      if (els.painelBaseOpcoes) {
        els.painelBaseOpcoes.classList.add("hidden-ui");
      }
    }

    function abrirPainelCercoManualOpcoes(idManual, totalPontos = 0) {
      if (!els.painelCercoManualOpcoes || !els.painelCercoManualConteudo) return false;
      fecharPainelEventoOpcoes();

      if (typeof fecharPainelFocoOpcoes === "function") fecharPainelFocoOpcoes();
      if (typeof fecharPainelBaseOpcoes === "function") fecharPainelBaseOpcoes();

      const idSeguro = typeof escapeJsTexto === "function"
        ? escapeJsTexto(idManual)
        : String(idManual).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

      els.painelCercoManualConteudo.innerHTML =
        `<strong>Cerco manual</strong><br>` +
        `${Number(totalPontos || 0)} ponto(s) marcados<br>` +
        `<div class="popup-actions">` +
        `<button type="button" class="secondary" onclick="removerCercoManual('${idSeguro}')">Remover cerco manual</button>` +
        `</div>`;

      els.painelCercoManualOpcoes.classList.remove("hidden-ui");
      return true;
    }

    function fecharPainelCercoManualOpcoes() {
      if (els.painelCercoManualOpcoes) {
        els.painelCercoManualOpcoes.classList.add("hidden-ui");
      }
    }

    function tipoPontoOperacionalLabel(tipo) {
      return "Base";
    }

    function tipoPontoOperacionalIcon(tipo) {
      return "B";
    }

    function indiceBaseOperacional() {
      return pontosOperacionais.findIndex(p => (p.tipo || "base") === "base");
    }

    function atualizarBotaoBaseOperacional() {
      const btn = document.getElementById("btnMarcarBase");
      if (!btn) return;
      btn.textContent = "Marcar base";
      btn.classList.remove("active-toggle");
    }

    function alternarBaseOperacional() {
      iniciarMarcacaoOperacional("base");
    }

    function desenharPontosOperacionais() {
      layerPontosOperacionais.clearLayers();

      // Permite várias bases operacionais. Para remover uma base, toque nela no mapa e clique em “Remover base”.
      pontosOperacionais = pontosOperacionais
        .filter(p => (p.tipo || "base") === "base");

      pontosOperacionais.forEach((p, idx) => {
        if (!Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lon))) return;

        const tipo = "base";
        const label = tipoPontoOperacionalLabel(tipo);
        const lat = Number(p.lat);
        const lon = Number(p.lon);
        const htmlIcon = `<button type="button" class="marker-op ${tipo} base-marker-button" title="Base ${idx + 1}" aria-label="Abrir opções da base ${idx + 1}">${tipoPontoOperacionalIcon(tipo)}</button>`;
        const painelHtml =
          `<strong>${escapeHtml(label)} ${idx + 1}</strong><br>` +
          `${lat.toFixed(6)}, ${lon.toFixed(6)}<br>` +
          `<div class="popup-actions"><button type="button" class="secondary" onclick="removerPontoOperacional(${idx})">Remover base</button></div>`;

        const marker = L.marker([lat, lon], {
          icon: L.divIcon({
            className: "base-operacional-div-icon",
            html: htmlIcon,
            iconSize: [44, 44],
            iconAnchor: [22, 22]
          }),
          pane: "paneRota",
          interactive: true,
          keyboard: false,
          bubblingMouseEvents: false,
          riseOnHover: true,
          zIndexOffset: 9000
        }).addTo(layerPontosOperacionais);

        const abrirPainelDaBase = (ev = null) => {
          try {
            if (ev && ev.originalEvent) {
              ev.originalEvent.preventDefault();
              ev.originalEvent.stopPropagation();
            } else if (ev) {
              ev.preventDefault && ev.preventDefault();
              ev.stopPropagation && ev.stopPropagation();
            }
          } catch (_) {}

          abrirPainelBaseOpcoes(painelHtml);
          setStatus(`Base ${idx + 1} selecionada. Use Remover base para apagar só esta base.`, "ok");
        };

        marker.on("click", abrirPainelDaBase);
        marker.on("touchstart", abrirPainelDaBase);

        const conectarCliqueDiretoBase = () => {
          const el = marker.getElement();
          if (!el || el.dataset.baseClickReady === "1") return;
          el.dataset.baseClickReady = "1";

          const handler = (ev) => abrirPainelDaBase(ev);
          el.addEventListener("click", handler, { passive: false });
          el.addEventListener("touchstart", handler, { passive: false });

          const btn = el.querySelector(".base-marker-button");
          if (btn) {
            btn.addEventListener("click", handler, { passive: false });
            btn.addEventListener("touchstart", handler, { passive: false });
          }
        };

        setTimeout(conectarCliqueDiretoBase, 60);
        setTimeout(conectarCliqueDiretoBase, 300);
        setTimeout(conectarCliqueDiretoBase, 1000);
      });

      atualizarBotaoBaseOperacional();
    }

    function salvarPontosOperacionais() {
      try {
        const bases = Array.isArray(pontosOperacionais)
          ? pontosOperacionais.filter(p => (p.tipo || "base") === "base")
          : [];
        localStorage.setItem(PONTOS_OPERACIONAIS_KEY, JSON.stringify(bases));
      } catch (err) {
        console.warn("Não foi possível salvar bases operacionais:", err);
      }
    }

    function atualizarBotaoCerco() {
      const btn = document.getElementById("btnAreaAcaoAlvo");
      if (!btn) return;

      const temCerco = !!(
        layerAreaAcao &&
        layerAreaAcao.getLayers &&
        layerAreaAcao.getLayers().length > 0
      );

      btn.textContent = "Limpar cercos";
      btn.disabled = !temCerco;
      btn.classList.toggle("active-toggle", temCerco);
    }

    function carregarPontosOperacionais() {
      try {
        const salvo = JSON.parse(localStorage.getItem(PONTOS_OPERACIONAIS_KEY) || "[]");
        pontosOperacionais = Array.isArray(salvo)
          ? salvo.filter(p => (p.tipo || "base") === "base")
          : [];
      } catch (_) {
        pontosOperacionais = [];
      }
      desenharPontosOperacionais();
    }

    function iniciarMarcacaoOperacional(tipo) {
      modoMarcacaoOperacional = "base";
      setStatus("Toque no mapa para marcar a base operacional.", "warn");
    }

    function cancelarMarcacaoOperacional() {
      modoMarcacaoOperacional = null;
      if (aceiroManualAtivo) {
        cancelarAceiroManual();
      }
      setStatus("Marcação cancelada.", "ok");
    }

    function adicionarPontoOperacional(latlng) {
      if (!modoMarcacaoOperacional) return false;

      pontosOperacionais.push({
        tipo: "base",
        lat: latlng.lat,
        lon: latlng.lng,
        criadoEm: Date.now()
      });

      modoMarcacaoOperacional = null;
      salvarPontosOperacionais();
      desenharPontosOperacionais();
      setStatus("Base operacional marcada. Para remover uma base, toque nela no mapa e clique em Remover base.", "ok");
      agendarSalvamentoOfflineAutomatico();
      return true;
    }

    function removerPontoOperacional(idx) {
      pontosOperacionais.splice(idx, 1);
      fecharPainelBaseOpcoes();
      salvarPontosOperacionais();
      desenharPontosOperacionais();
      setStatus("Base operacional removida.", "ok");
      agendarSalvamentoOfflineAutomatico();
    }

    function limparBasesOperacionais() {
      pontosOperacionais = [];
      modoMarcacaoOperacional = null;
      fecharPainelBaseOpcoes();
      salvarPontosOperacionais();
      desenharPontosOperacionais();
      setStatus("Todas as bases foram removidas.", "ok");
      agendarSalvamentoOfflineAutomatico();
    }

    function distanciaRestanteNaRota(coords, startIdx, loc, nextIdx) {
      if (!Array.isArray(coords) || coords.length < 2) return Infinity;

      let total = 0;
      const idx = Math.max(0, Math.min(nextIdx, coords.length - 1));
      const next = coords[idx];

      if (next) total += distanciaKm(loc.lat, loc.lon, next[0], next[1]);

      for (let i = idx; i < coords.length - 1; i++) {
        total += distanciaKm(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
      }

      return total;
    }

    function analisarPosicaoNaRota(loc, coords) {
      if (!loc || !Array.isArray(coords) || coords.length < 2) return null;

      let melhor = {
        distanciaKm: Infinity,
        idx: 0
      };

      for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i];
        const b = coords[i + 1];
        const d = distanciaPontoSegmentoKm(loc.lat, loc.lon, a[0], a[1], b[0], b[1]);

        if (d < melhor.distanciaKm) {
          melhor = { distanciaKm: d, idx: i };
        }
      }

      let nextIdx = Math.min(melhor.idx + 1, coords.length - 1);
      if (distanciaKm(loc.lat, loc.lon, coords[nextIdx][0], coords[nextIdx][1]) < 0.035 && nextIdx < coords.length - 1) {
        nextIdx++;
      }

      const next = coords[nextIdx];
      const destino = coords[coords.length - 1];
      const restanteKm = distanciaRestanteNaRota(coords, melhor.idx, loc, nextIdx);
      const diretoDestinoKm = distanciaKm(loc.lat, loc.lon, destino[0], destino[1]);
      const rumo = next ? bearingGraus(loc.lat, loc.lon, next[0], next[1]) : NaN;

      return {
        desvioKm: melhor.distanciaKm,
        nextIdx,
        next,
        restanteKm,
        diretoDestinoKm,
        rumo
      };
    }

    function desenharIndicacaoNavegacao(loc, analise) {
      layerNavegacaoInterna.clearLayers();

      if (!loc || !analise || !analise.next) return;

      L.marker([analise.next[0], analise.next[1]], {
        icon: L.divIcon({
          className: "",
          html: '<div class="nav-arrow-marker"></div>',
          iconSize: [38, 38],
          iconAnchor: [19, 19]
        }),
        pane: "paneRota",
        interactive: false
      }).addTo(layerNavegacaoInterna);

      L.polyline([[loc.lat, loc.lon], analise.next], {
        color: analise.desvioKm > 0.12 ? "#ff8a8a" : "#8fffd0",
        weight: 4,
        opacity: 0.9,
        dashArray: "6 8",
        pane: "paneRota",
        interactive: false
      }).addTo(layerNavegacaoInterna);
    }

    function atualizarNavegacaoInterna(loc = ultimaLocalizacao) {
      if (!navegacaoInternaAtiva || !rotaAcessoAtual || !loc) return;

      const analise = analisarPosicaoNaRota(loc, rotaAcessoAtual.coords);
      if (!analise) return;

      desenharIndicacaoNavegacao(loc, analise);

      const rumoTxt = Number.isFinite(analise.rumo) ? `${Math.round(analise.rumo)}° ${direcaoCardinal(analise.rumo)}` : "--";
      const desvioM = Math.round(analise.desvioKm * 1000);
      const restanteTxt = formatarDistanciaOperacional(analise.restanteKm);
      const destinoTxt = formatarDistanciaOperacional(analise.diretoDestinoKm);
      const fora = analise.desvioKm > 0.12;

      if (els.rotaStatus) {
        els.rotaStatus.innerHTML =
          `<span class="${fora ? "danger" : "ok"}">Navegação interna ativa</span> · restante ${escapeHtml(restanteTxt)} · rumo ${escapeHtml(rumoTxt)} · desvio ${desvioM} m`;
      }

      if (seguirGpsAtivo) {
        map.setView([loc.lat, loc.lon], Math.max(16, map.getZoom(), map.getMinZoom()), { animate: true });
      }
    }

    function iniciarNavegacaoInterna(coords = null, destino = null, titulo = "") {
      const rotaCoords = (coords || (rotaAcessoAtual && rotaAcessoAtual.coords) || [])
        .map(p => [Number(p[0]), Number(p[1])])
        .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));

      if (rotaCoords.length < 2) {
        alert("Calcule uma rota primeiro. Depois toque na linha azul para navegar.");
        return;
      }

      rotaAcessoAtual = {
        coords: rotaCoords,
        destino: destino || rotaAcessoAtual?.destino || {
          lat: rotaCoords[rotaCoords.length - 1][0],
          lon: rotaCoords[rotaCoords.length - 1][1]
        },
        titulo: titulo || rotaAcessoAtual?.titulo || "rota de acesso",
        criadoEm: Date.now()
      };

      navegacaoInternaAtiva = true;
      gpsCampoAtivo = true;
      seguirGpsAtivo = true;
      atualizarBotoesNavegacaoInterna();

      iniciarGravacaoRota();

      obterLocalizacaoAtual().then((loc) => {
        atualizarMarcadorUsuario(loc);
        atualizarNavegacaoInterna(loc);
      }).catch((err) => {
        setStatus(err.message || "Não foi possível ativar navegação interna.", "warn");
      });
    }

    function iniciarNavegacaoDaRotaAtual() {
      iniciarNavegacaoInterna();
    }

    function atualizarBotoesNavegacaoInterna() {
      const btnNavegar = document.getElementById("btnNavegarRotaInterna");
      const btnParar = document.getElementById("btnPararNavegacaoInterna");
      const btnLimparRotaAlvo = document.getElementById("btnLimparRotaAcessoPainel");

      const existeRota = !!(rotaAcessoAtual && Array.isArray(rotaAcessoAtual.coords) && rotaAcessoAtual.coords.length >= 2);

      if (btnNavegar) {
        btnNavegar.classList.toggle("hidden-ui", !existeRota || navegacaoInternaAtiva);
      }

      if (btnParar) {
        btnParar.classList.toggle("hidden-ui", !navegacaoInternaAtiva);
      }

      if (btnLimparRotaAlvo) {
        btnLimparRotaAlvo.classList.toggle("hidden-ui", !existeRota);
      }
    }

    function pararNavegacaoInterna() {
      navegacaoInternaAtiva = false;
      layerNavegacaoInterna.clearLayers();
      atualizarBotoesNavegacaoInterna();
      if (els.rotaStatus) atualizarStatusRota("navegação até alvo parada");
    }

    function criarLinhaRotaNavegavel(coords, popupTexto = "Rota de acesso") {
      const linha = L.polyline(coords, {
        color: "#00d4ff",
        weight: 9,
        opacity: 0.98,
        pane: "paneRota",
        interactive: true
      });

      linha.bindPopup(
        `<strong>${escapeHtml(popupTexto)}</strong><br>` +
        `<span class="route-click-help">Toque na linha para navegar pelo GPS dentro do site.</span><br>` +
        `<div class="popup-actions"><button type="button" onclick="iniciarNavegacaoDaRotaAtual()">Iniciar navegação interna</button></div>`
      );

      linha.on("click", () => iniciarNavegacaoInterna(coords, null, popupTexto));
      return linha;
    }

    function limparRotaAcesso() {
      pararNavegacaoInterna();
      rotaAcessoAtual = null;
      layerRotaAcesso.clearLayers();
      atualizarBotoesNavegacaoInterna();
      if (els.rotaStatus) {
        atualizarStatusRota("rota até alvo limpa");
      }
      agendarSalvamentoOfflineAutomatico();
    }

    function desenharLinhaRetaAcesso(origem, destino) {
      layerRotaAcesso.clearLayers();
      layerNavegacaoInterna.clearLayers();

      const coords = [[origem.lat, origem.lon], [destino.lat, destino.lon]];
      rotaAcessoAtual = {
        coords,
        destino,
        titulo: "acesso direto em linha reta",
        criadoEm: Date.now()
      };
      atualizarBotoesNavegacaoInterna();

      criarLinhaRotaNavegavel(coords, "Acesso direto em linha reta")
        .setStyle({ color: "#fffb8a", weight: 7, dashArray: "8 8" })
        .addTo(layerRotaAcesso);

      const bounds = L.latLngBounds([[origem.lat, origem.lon], [destino.lat, destino.lon]]);
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.25), { maxZoom: 15, animate: true });

      const km = distanciaKm(origem.lat, origem.lon, destino.lat, destino.lon);
      if (els.rotaStatus) {
        els.rotaStatus.innerHTML =
          `<span class="warn">Acesso: rota por estrada não retornou. Linha reta até o fogo: ${km.toFixed(2)} km. Toque na linha amarela para navegar dentro do site.</span>`;
      }
    }

    async function rotaParaAlvoOperacional() {
      if (!alvoOperacionalAtual || !Number.isFinite(Number(alvoOperacionalAtual.lat)) || !Number.isFinite(Number(alvoOperacionalAtual.lon))) {
        alert("Nenhum alvo definido. Toque em um foco/evento e escolha Definir como alvo.");
        return;
      }

      try {
        await calcularRotaFacilPara(Number(alvoOperacionalAtual.lat), Number(alvoOperacionalAtual.lon));
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        if (els.rotaStatus) {
          els.rotaStatus.innerHTML = `<span class="danger">Não foi possível calcular rota até o alvo: ${escapeHtml(msg)}</span>`;
        }
        setStatus("Não foi possível calcular rota até o alvo.", "warn");
      }
    }

    function limparAreaAcao() {
      if (layerAreaAcao && layerAreaAcao.clearLayers) {
        layerAreaAcao.clearLayers();
      }

      // Limpa também os aceiros/estradas/trilhas usados como cerco automático.
      if (typeof limparEstradasDestaque === "function") {
        limparEstradasDestaque();
      }

      if (typeof atualizarBotoesPainelFoco === "function") {
        atualizarBotoesPainelFoco();
      }

      atualizarBotaoCerco();

      setStatus("Cercos e aceiros removidos.", "ok");
      agendarSalvamentoOfflineAutomatico();
    }

    function limparAlvoOperacional() {
      alvoOperacionalAtual = null;

      if (layerAlvoOperacional && layerAlvoOperacional.clearLayers) {
        layerAlvoOperacional.clearLayers();
      }

      limparAreaAcao();

      if (rotaAcessoAtual) {
        limparRotaAcesso();
      }

      if (typeof atualizarPainelOperacional === "function") {
        atualizarPainelOperacional();
      }

      if (typeof atualizarBotoesPainelFoco === "function") {
        atualizarBotoesPainelFoco();
      }

      setStatus("Alvo removido.", "ok");
      agendarSalvamentoOfflineAutomatico();
    }

    function copiarAlvoOperacional() {
      if (!alvoOperacionalAtual || !Number.isFinite(Number(alvoOperacionalAtual.lat)) || !Number.isFinite(Number(alvoOperacionalAtual.lon))) {
        alert("Nenhum alvo definido para copiar.");
        return;
      }

      const lat = Number(alvoOperacionalAtual.lat).toFixed(6);
      const lon = Number(alvoOperacionalAtual.lon).toFixed(6);
      const titulo = alvoOperacionalAtual.titulo || "alvo operacional";
      const texto = `${titulo}\nLatitude: ${lat}\nLongitude: ${lon}\n${lat}, ${lon}`;

      copiarTexto(texto, "Coordenada do alvo copiada.");
    }

    async function calcularRotaFacilPara(lat, lon) {
      const destino = { lat: Number(lat), lon: Number(lon) };
      if (!Number.isFinite(destino.lat) || !Number.isFinite(destino.lon)) {
        alert("Coordenada inválida para calcular rota.");
        return;
      }

      if (els.rotaStatus) {
        els.rotaStatus.innerHTML = `<span class="warn">Calculando melhor acesso por estradas/trilhas mapeadas...</span>`;
      }

      let origem = null;

      try {
        origem = await obterLocalizacaoAtual();

        const url =
          `https://router.project-osrm.org/route/v1/driving/${origem.lon.toFixed(6)},${origem.lat.toFixed(6)};${destino.lon.toFixed(6)},${destino.lat.toFixed(6)}` +
          `?overview=full&geometries=geojson&alternatives=true&steps=false`;

        const resp = await fetchComTimeout(url, { cache: "no-store", mode: "cors" }, 16000);
        if (!resp.ok) throw new Error("HTTP " + resp.status);

        const json = await resp.json();
        const rotas = Array.isArray(json.routes) ? json.routes : [];
        if (!rotas.length) throw new Error("nenhuma rota retornada");

        const rota = rotas
          .filter(r => r && r.geometry && Array.isArray(r.geometry.coordinates))
          .sort((a, b) => Number(a.duration || Infinity) - Number(b.duration || Infinity))[0];

        if (!rota) throw new Error("rota sem geometria");

        const coords = rota.geometry.coordinates
          .map(p => [Number(p[1]), Number(p[0])])
          .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));

        if (coords.length < 2) throw new Error("rota sem pontos suficientes");

        layerRotaAcesso.clearLayers();

        rotaAcessoAtual = {
          coords,
          destino,
          titulo: "rota sugerida de acesso ao fogo",
          criadoEm: Date.now()
        };
        atualizarBotoesNavegacaoInterna();

        criarLinhaRotaNavegavel(coords, "Rota sugerida de acesso ao fogo").addTo(layerRotaAcesso);

        L.circleMarker([origem.lat, origem.lon], {
          radius: 7,
          color: "#ffffff",
          weight: 2,
          fillColor: "#4aa3ff",
          fillOpacity: 0.95,
          pane: "paneRota"
        }).bindPopup("Origem: sua localização").addTo(layerRotaAcesso);

        L.circleMarker([destino.lat, destino.lon], {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: "#ff6b35",
          fillOpacity: 0.95,
          pane: "paneRota"
        }).bindPopup("Destino: foco/evento").addTo(layerRotaAcesso);

        const bounds = L.latLngBounds(coords);
        if (bounds.isValid()) map.fitBounds(bounds.pad(0.18), { maxZoom: 16, animate: true });

        const km = Number(rota.distance || 0) / 1000;
        const tempo = formatarDuracaoMin(rota.duration || 0);

        if (els.rotaStatus) {
          els.rotaStatus.innerHTML =
            `<span class="ok">Acesso sugerido: ${km.toFixed(2)} km · ${escapeHtml(tempo)}. Toque na linha azul para navegar pelo GPS dentro do site.</span>`;
        }
        agendarSalvamentoOfflineAutomatico(500, true);
      } catch (err) {
        if (origem) {
          desenharLinhaRetaAcesso(origem, destino);
        } else if (els.rotaStatus) {
          els.rotaStatus.innerHTML =
            `<span class="danger">Não foi possível calcular acesso: ${escapeHtml(err && err.message ? err.message : String(err))}</span>`;
        }
      }
    }

    function atualizarContadorEvento(tipo, total) {
      const alvo = tipo === "ativo" ? els.eventosAtivosCount : els.eventosObservacaoCount;
      if (alvo) alvo.textContent = String(Number(total || 0));
    }

    function registrarLogCerco() {
    }

    let DEBUG_CERCO_ULTIMO = {
      motivo: "sem-log",
      tentativas: [],
      overpass: [],
      desenho: null,
      erro: null,
      alvoId: null,
      alvo: null
    };

    function resumoElementosOverpass(json) {
      const elementos = Array.isArray(json && json.elements) ? json.elements : [];
      let nodes = 0;
      let ways = 0;
      const highways = {};
      const tagsEncontradas = {
        tracktype: 0,
        surface: 0,
        trail_visibility: 0,
        firebreak: 0,
        cutline: 0
      };

      elementos.forEach(el => {
        if (el.type === "node") nodes++;
        if (el.type === "way") {
          ways++;
          const tags = el.tags || {};
          const h = tags.highway || "sem_highway";
          highways[h] = (highways[h] || 0) + 1;
          if (tags.tracktype) tagsEncontradas.tracktype++;
          if (tags.surface) tagsEncontradas.surface++;
          if (tags.trail_visibility) tagsEncontradas.trail_visibility++;
          if (tags.firebreak || tags.barrier === "firebreak" || tags.natural === "firebreak" || tags.landuse === "firebreak") tagsEncontradas.firebreak++;
          if (tags.man_made === "cutline") tagsEncontradas.cutline++;
        }
      });

      return { totalElementos: elementos.length, nodes, ways, highways, tagsEncontradas };
    }

    const OVERPASS_ENDPOINTS = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter"
    ];
    const alvosEstradas = new Map();
    let estradasAlvoAtualId = null;
    const estradasCamadasPorAlvo = new Map();

    let aceiroManualAtivo = false;
    let aceiroManualAlvoId = null;
    let aceiroManualPontos = [];
    let aceiroManualLinhaTemp = null;
    let aceiroManualSequencia = 0;

    const ROTA_STORAGE_KEY = "queimadas_goias_rota_percorrida_v1";
    const OFFLINE_SNAPSHOT_KEY = "queimadas_goias_snapshot_offline_v1";
    const OFFLINE_TILE_CACHE = "queimadas-goias-tiles-v1";
    let rotaWatchId = null;
    let rotaPontos = [];
    let rotaLinha = null;
    let eventosOfflineAtuais = { ativo: [], observacao: [] };

    function atualizarBotaoGravacaoRota() {
      const btn = document.getElementById("btnToggleRota");
      if (!btn) return;

      const gravando = rotaWatchId !== null;
      btn.textContent = gravando ? "Parar gravação" : "Gravar caminho";
      btn.classList.toggle("primary", !gravando);
      btn.classList.toggle("secondary", gravando);
      btn.classList.toggle("active-toggle", gravando);
    }

    function alternarGravacaoRota() {
      if (rotaWatchId !== null) {
        pararGravacaoRota();
      } else {
        iniciarGravacaoRota();
      }
    }

    function atualizarStatusRota(extra = "") {
      atualizarBotaoGravacaoRota();
      if (!els.rotaStatus) return;

      const km = calcularDistanciaRotaKm(rotaPontos);
      const estado = rotaWatchId !== null ? "gravando" : "parado";
      els.rotaStatus.innerHTML =
        `<span class="route-line-info">Caminho percorrido: ${estado}</span> · ${rotaPontos.length} ponto(s) · ${km.toFixed(2)} km${extra ? " · " + escapeHtml(extra) : ""}`;
    }

    function calcularDistanciaRotaKm(pontos) {
      let total = 0;
      for (let i = 1; i < pontos.length; i++) {
        total += distanciaKm(pontos[i - 1].lat, pontos[i - 1].lon, pontos[i].lat, pontos[i].lon);
      }
      return total;
    }

    function salvarRotaLocal() {
      try {
        localStorage.setItem(ROTA_STORAGE_KEY, JSON.stringify(rotaPontos));
      } catch (_) {}
    }

    function desenharRotaPercorrida() {
      layerRotaPercorrida.clearLayers();

      if (rotaLinha) {
        try { map.removeLayer(rotaLinha); } catch (_) {}
        rotaLinha = null;
      }

      const coords = rotaPontos
        .map(p => [Number(p.lat), Number(p.lon)])
        .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));

      if (coords.length >= 2) {
        rotaLinha = L.polyline(coords, {
          color: "#8fffd0",
          weight: 6,
          opacity: 0.95,
          pane: "paneRota"
        }).addTo(layerRotaPercorrida);
      }

      if (coords.length) {
        const ultimo = coords[coords.length - 1];
        L.circleMarker(ultimo, {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: "#8fffd0",
          fillOpacity: 0.95,
          pane: "paneRota"
        }).bindPopup("Último ponto da rota gravada").addTo(layerRotaPercorrida);
      }

      atualizarStatusRota();
    }

    function carregarRotaLocal() {
      try {
        const salvo = JSON.parse(localStorage.getItem(ROTA_STORAGE_KEY) || "[]");
        if (Array.isArray(salvo)) {
          rotaPontos = salvo
            .map(p => ({
              lat: Number(p.lat),
              lon: Number(p.lon),
              accuracy: Number(p.accuracy || 0),
              timestamp: Number(p.timestamp || Date.now())
            }))
            .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
        }
      } catch (_) {
        rotaPontos = [];
      }

      desenharRotaPercorrida();
    }

    function adicionarPontoRota(pos) {
      registrarUltimaLocalizacao(pos);
      const lat = Number(pos.coords.latitude);
      const lon = Number(pos.coords.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const novo = {
        lat,
        lon,
        accuracy: Number(pos.coords.accuracy || 0),
        timestamp: Date.now()
      };

      const ultimo = rotaPontos[rotaPontos.length - 1];
      if (ultimo) {
        const metros = distanciaKm(ultimo.lat, ultimo.lon, novo.lat, novo.lon) * 1000;
        // Evita gravar ruído parado, mas mantém deslocamento real.
        if (metros < 6) {
          atualizarStatusRota("aguardando deslocamento");
          return;
        }
      }

      rotaPontos.push(novo);
      salvarRotaLocal();
      desenharRotaPercorrida();
    }

    function iniciarGravacaoRota() {
      if (!navigator.geolocation) {
        setStatus("Seu navegador não suporta gravação de rota por GPS.", "warn");
        return;
      }

      if (rotaWatchId !== null) {
        atualizarStatusRota("já está gravando");
        return;
      }

      rotaWatchId = navigator.geolocation.watchPosition((pos) => {
        adicionarPontoRota(pos);
      }, (err) => {
        setStatus("Não foi possível gravar a rota. Verifique a permissão de localização.", "warn");
        atualizarStatusRota(err && err.message ? err.message : "erro no GPS");
      }, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      });

      atualizarStatusRota("iniciada");
    }

    function pararGravacaoRota() {
      if (rotaWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(rotaWatchId);
      }
      rotaWatchId = null;
      salvarRotaLocal();
      atualizarStatusRota("salva no navegador");
    }

    function limparRotaPercorrida() {
      pararGravacaoRota();
      rotaPontos = [];
      salvarRotaLocal();
      desenharRotaPercorrida();
      atualizarStatusRota("limpa");
    }

    function normalizarMetaEvento(tipo) {
      const meta = eventosAtualizacaoMeta[tipo] || {};
      return {
        baixadoEm: Number(meta.baixadoEm || 0),
        lastModified: String(meta.lastModified || ""),
        offline: !!meta.offline,
        erroEm: Number(meta.erroEm || 0),
        erro: String(meta.erro || "")
      };
    }

    function formatarDataEventoMeta(ts) {
      const n = Number(ts || 0);
      if (!Number.isFinite(n) || n <= 0) return "não registrado";
      return new Date(n).toLocaleString("pt-BR");
    }

    function formatarLastModifiedEvento(valor) {
      if (!valor) return "não informado pelo servidor";
      const t = new Date(valor).getTime();
      return Number.isFinite(t) && t > 0 ? new Date(t).toLocaleString("pt-BR") : String(valor);
    }

    function linhasAtualizacaoEvento(tipo, offlineForcado = false) {
      const meta = normalizarMetaEvento(tipo);
      const modoOffline = offlineForcado || meta.offline || estadoOfflineCarregadoNestaSessao || navigator.onLine === false;
      const linhas = [];

      linhas.push(`<div class="evento-popup-linha destaque"><span>Modo dos dados</span><strong>${modoOffline ? "offline / retrato salvo" : "online"}</strong></div>`);

      if (ultimoEstadoSalvoEm) {
        linhas.push(`<div class="evento-popup-linha destaque"><span>Último estado salvo no aparelho</span><strong>${escapeHtml(formatarDataEventoMeta(ultimoEstadoSalvoEm))}</strong></div>`);
      }

      if (meta.baixadoEm) {
        linhas.push(`<div class="evento-popup-linha"><span>KML baixado pelo app em</span><strong>${escapeHtml(formatarDataEventoMeta(meta.baixadoEm))}</strong></div>`);
      }

      if (meta.lastModified) {
        linhas.push(`<div class="evento-popup-linha"><span>Última modificação informada pelo INPE</span><strong>${escapeHtml(formatarLastModifiedEvento(meta.lastModified))}</strong></div>`);
      }

      if (meta.erroEm && meta.erro) {
        linhas.push(`<div class="evento-popup-linha"><span>Última falha ao atualizar evento</span><strong>${escapeHtml(formatarDataEventoMeta(meta.erroEm))} · ${escapeHtml(meta.erro)}</strong></div>`);
      }

      return linhas.join("");
    }

    function resumoAtualizacaoEventosTexto(tipo) {
      const meta = normalizarMetaEvento(tipo);
      if (estadoOfflineCarregadoNestaSessao || navigator.onLine === false) {
        return ultimoEstadoSalvoEm ? `modo offline, estado salvo em ${formatarDataEventoMeta(ultimoEstadoSalvoEm)}` : "modo offline, sem data salva registrada";
      }
      if (meta.lastModified) return `KML ${tipo === "ativo" ? "ativos" : "observação"} modificado no INPE em ${formatarLastModifiedEvento(meta.lastModified)}`;
      if (meta.baixadoEm) return `KML ${tipo === "ativo" ? "ativos" : "observação"} baixado pelo app em ${formatarDataEventoMeta(meta.baixadoEm)}`;
      if (meta.erroEm) return `falha ao atualizar KML ${tipo === "ativo" ? "ativos" : "observação"} em ${formatarDataEventoMeta(meta.erroEm)}`;
      return "";
    }

    function registrarEventoSnapshot(tipo, geometria, coords, titulo) {
      const lista = tipo === "ativo" ? eventosOfflineAtuais.ativo : eventosOfflineAtuais.observacao;
      const limpos = (coords || [])
        .map(p => [Number(p[0]), Number(p[1])])
        .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));

      if (!limpos.length) return;

      lista.push({
        tipo,
        geometria,
        coords: limpos,
        titulo: String(titulo || (tipo === "ativo" ? "Evento de fogo ativo" : "Evento em observação")),
        baixadoEm: normalizarMetaEvento(tipo).baixadoEm || Date.now(),
        lastModified: normalizarMetaEvento(tipo).lastModified || ""
      });
    }

    function popupEventoSnapshot(tipo, item) {
      const titulo = item && item.titulo ? item.titulo : (tipo === "ativo" ? "Evento de fogo ativo" : "Evento em observação");
      const coords = item && item.coords ? item.coords : [];
      const centro = centroDosPontos(coords);
      const alvoId = registrarAlvoEstradas(coords, titulo);
      const geometria = item && item.geometria ? item.geometria : "geometria";

      return `<div class="evento-popup-completo">` +
        `<div class="evento-popup-titulo">${escapeHtml(tipo === "ativo" ? "Evento de fogo ativo" : "Evento em observação")}</div>` +
        `<div class="evento-popup-subtitulo">${escapeHtml(titulo)}</div>` +
        `<div class="evento-popup-tabela">` +
        linhasAtualizacaoEvento(tipo, true) +
        `<div class="evento-popup-linha"><span>Fonte</span><strong>retrato offline salvo</strong></div>` +
        `<div class="evento-popup-linha"><span>Tipo de geometria</span><strong>${escapeHtml(geometria)}</strong></div>` +
        `<div class="evento-popup-linha"><span>Coordenadas usadas</span><strong>${coords.length}</strong></div>` +
        `</div>` +
        (centro ? botoesAcaoMapa(centro[0], centro[1], alvoId, titulo) : "") +
        `</div>`;
    }

    function desenharEventosSnapshot(eventos) {
      layerEventosAtivos.clearLayers();
      layerEventosObservacao.clearLayers();
      resetarEventosMapaResumo();

      const tipos = [
        ["ativo", layerEventosAtivos],
        ["observacao", layerEventosObservacao]
      ];

      const contadores = { ativo: 0, observacao: 0 };

      tipos.forEach(([tipo, layer]) => {
        const lista = eventos && Array.isArray(eventos[tipo]) ? eventos[tipo] : [];
        const style = styleEvento(tipo);

        lista.forEach((item) => {
          const coords = (item.coords || [])
            .map(p => [Number(p[0]), Number(p[1])])
            .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));

          if (!coords.length) return;

          const popup = popupEventoSnapshot(tipo, item);

          if (item.geometria === "point") {
            const [lat, lon] = coords[0];
            const ponto = L.circleMarker([lat, lon], {
              radius: 12,
              color: "#ffffff",
              weight: 3,
              fillColor: style.fillColor,
              fillOpacity: 0.95,
              pane: "paneEventos",
              interactive: true,
              bubblingMouseEvents: false
            });
            configurarCamadaEventoClicavel(ponto, popup).addTo(layer);
            marcadorDestaqueEvento(lat, lon, tipo, popup);
            registrarEventoNoMapa([lat, lon], tipo);
          } else if (item.geometria === "polygon") {
            const polygon = L.polygon(coords, Object.assign({}, style, {
              weight: Math.max(4, style.weight || 2),
              fillOpacity: Math.max(0.24, style.fillOpacity || 0.18),
              interactive: true,
              bubblingMouseEvents: false
            }));
            configurarCamadaEventoClicavel(polygon, popup).addTo(layer);
            registrarEventoNoMapa(coords, tipo);
            const centro = centroDosPontos(coords) || coords[Math.floor(coords.length / 2)];
            if (centro) marcadorDestaqueEvento(centro[0], centro[1], tipo, popup);
          } else {
            const linhaVisual = L.polyline(coords, Object.assign({}, style, {
              weight: Math.max(5, style.weight || 3),
              opacity: 1,
              interactive: true,
              bubblingMouseEvents: false
            }));
            const linhaClique = L.polyline(coords, {
              color: "#ffffff",
              weight: 24,
              opacity: 0.01,
              pane: "paneEventos",
              interactive: true,
              bubblingMouseEvents: false
            });

            configurarCamadaEventoClicavel(linhaVisual, popup).addTo(layer);
            configurarCamadaEventoClicavel(linhaClique, popup).addTo(layer);

            registrarEventoNoMapa(coords, tipo);
            const meio = coords[Math.floor(coords.length / 2)];
            if (meio) marcadorDestaqueEvento(meio[0], meio[1], tipo, popup);
          }

          contadores[tipo]++;
        });

        if (!map.hasLayer(layer)) layer.addTo(map);
      });

      atualizarContadorEvento("ativo", contadores.ativo);
      atualizarContadorEvento("observacao", contadores.observacao);
      atualizarResumoEventosMapa();

      if (els.eventosStatus) {
        const data = ultimoEstadoSalvoEm ? new Date(ultimoEstadoSalvoEm).toLocaleString("pt-BR") : "data não registrada";
        els.eventosStatus.textContent =
          `Retrato offline salvo em ${data}: ${contadores.ativo} evento(s) ativo(s) e ${contadores.observacao} em observação.`;
      }
    }

    function serializarAceirosAtuais() {
      const itens = [];

      estradasCamadasPorAlvo.forEach((grupo, id) => {
        grupo.getLayers().forEach((layer) => {
          if (layer && typeof layer.getLatLngs === "function") {
            const latLngs = layer.getLatLngs();
            const planos = Array.isArray(latLngs[0]) ? latLngs.flat(Infinity) : latLngs;
            const coords = planos
              .filter(p => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
              .map(p => [Number(p.lat), Number(p.lng)]);

            if (coords.length >= 2) itens.push({ id, coords });
          }
        });
      });

      return itens;
    }

    function restaurarAceirosSnapshot(itens = []) {
      layerEstradasDestaque.clearLayers();
      estradasCamadasPorAlvo.clear();

      itens.forEach((item, idx) => {
        const coords = (item.coords || [])
          .map(p => [Number(p[0]), Number(p[1])])
          .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));

        if (coords.length < 2) return;

        const grupo = L.layerGroup();
        L.polyline(coords, {
          color: "#fffb8a",
          weight: 9,
          opacity: 1,
          dashArray: "8 7",
          pane: "paneEstradas",
          interactive: false
        }).addTo(grupo);

        grupo.addTo(layerEstradasDestaque);
        estradasCamadasPorAlvo.set(item.id || ("offline_aceiro_" + idx), grupo);
      });

      atualizarStatusAceiro("Aceiros restaurados do retrato offline.");
    }

    function tileXY(lat, lon, z) {
      const latRad = lat * Math.PI / 180;
      const n = Math.pow(2, z);
      return {
        x: Math.floor((lon + 180) / 360 * n),
        y: Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n)
      };
    }

    function gerarUrlsTilesVisiveis() {
      const bounds = map.getBounds();
      const zBase = Math.max(1, Math.min(17, Math.round(map.getZoom())));
      const zooms = [...new Set([zBase, Math.max(1, zBase - 1), Math.min(17, zBase + 1)])];
      const urls = [];

      const templates = [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        "https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
      ];

      zooms.forEach((z) => {
        const nw = tileXY(bounds.getNorth(), bounds.getWest(), z);
        const se = tileXY(bounds.getSouth(), bounds.getEast(), z);
        const minX = Math.max(0, Math.min(nw.x, se.x));
        const maxX = Math.max(nw.x, se.x);
        const minY = Math.max(0, Math.min(nw.y, se.y));
        const maxY = Math.max(nw.y, se.y);

        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            templates.forEach(t => urls.push(t.replace("{z}", z).replace("{x}", x).replace("{y}", y)));
          }
        }
      });

      return [...new Set(urls)].slice(0, 220);
    }

    async function registrarServiceWorkerOffline() {
      if (!("serviceWorker" in navigator)) return false;

      try {
        const reg = await navigator.serviceWorker.register("./sw.js?v=1782947139", {
          updateViaCache: "none"
        });

        await reg.update();
        await navigator.serviceWorker.ready;

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!window.__recarregouPorAtualizacaoSW) {
            window.__recarregouPorAtualizacaoSW = true;
            window.location.reload();
          }
        });

        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        return true;
      } catch (err) {
        console.warn("Service worker offline não registrado:", err);
        return false;
      }
    }

    async function salvarTilesOffline() {
      if (!("caches" in window)) return { ok: 0, total: 0 };
      if (navigator.onLine === false) return { ok: 0, total: 0 };

      const urls = gerarUrlsTilesVisiveis();
      const cache = await caches.open(OFFLINE_TILE_CACHE);
      let ok = 0;

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
          const req = new Request(url, { mode: "no-cors" });
          const cached = await cache.match(req);
          if (!cached) {
            const resp = await fetchComTimeout(req, {}, 9000);
            await cache.put(req, resp.clone());
          }
          ok++;
        } catch (_) {}
      }

      return { ok, total: urls.length };
    }

    function montarSnapshotOfflineAtual() {
      return {
        version: 2,
        savedAt: Date.now(),
        periodo: els.periodo ? els.periodo.value : "24",
        municipio: els.municipio ? els.municipio.value : "",
        municipioTexto: textoFiltroCidade() || "Goiás inteiro",
        center: { lat: map.getCenter().lat, lon: map.getCenter().lng },
        zoom: map.getZoom(),
        focos: focosAtuais,
        eventos: eventosOfflineAtuais,
        eventosMeta: eventosAtualizacaoMeta,
        rota: rotaPontos,
        rotaAcesso: rotaAcessoAtual,
        pontosOperacionais,
        alvoOperacional: alvoOperacionalAtual,
        aceiros: serializarAceirosAtuais()
      };
    }

    async function salvarEstadoOfflineAutomatico(opcoes = {}) {
      const snapshot = montarSnapshotOfflineAtual();

      try {
        localStorage.setItem(OFFLINE_SNAPSHOT_KEY, JSON.stringify(snapshot));
        ultimoEstadoSalvoEm = Number(snapshot.savedAt || Date.now());
      } catch (err) {
        console.warn("Não foi possível salvar estado offline automático:", err);
        return { ok: false, tiles: { ok: 0, total: 0 } };
      }

      const swOk = await registrarServiceWorkerOffline();
      let tiles = { ok: 0, total: 0 };

      if (opcoes.salvarTiles && navigator.onLine !== false) {
        try {
          tiles = await salvarTilesOffline();
        } catch (_) {
          tiles = { ok: 0, total: 0 };
        }
      }

      return { ok: true, swOk, tiles };
    }

    function agendarSalvamentoOfflineAutomatico(delayMs = 900, salvarTiles = false) {
      clearTimeout(autoSaveOfflineTimer);
      autoSaveOfflineTimer = setTimeout(() => {
        salvarEstadoOfflineAutomatico({ salvarTiles }).catch(() => {});
      }, delayMs);
    }

    async function salvarMapaOffline() {
      return salvarEstadoOfflineAutomatico({ salvarTiles: true });
    }

    function carregarMapaOfflineSalvo() {
      let snapshot = null;

      try {
        snapshot = JSON.parse(localStorage.getItem(OFFLINE_SNAPSHOT_KEY) || "null");
      } catch (_) {
        snapshot = null;
      }

      if (!snapshot) {
        setStatus("Sem internet e ainda não existe um estado salvo neste navegador. Abra uma vez com internet.", "warn");
        return false;
      }

      estadoOfflineCarregadoNestaSessao = true;
      ultimoEstadoSalvoEm = Number(snapshot.savedAt || Date.now());
      eventosAtualizacaoMeta = snapshot.eventosMeta || {
        ativo: { baixadoEm: ultimoEstadoSalvoEm, lastModified: "", offline: true, erroEm: 0, erro: "" },
        observacao: { baixadoEm: ultimoEstadoSalvoEm, lastModified: "", offline: true, erroEm: 0, erro: "" }
      };
      eventosAtualizacaoMeta.ativo = Object.assign({ baixadoEm: ultimoEstadoSalvoEm, lastModified: "", erroEm: 0, erro: "" }, eventosAtualizacaoMeta.ativo || {}, { offline: true });
      eventosAtualizacaoMeta.observacao = Object.assign({ baixadoEm: ultimoEstadoSalvoEm, lastModified: "", erroEm: 0, erro: "" }, eventosAtualizacaoMeta.observacao || {}, { offline: true });

      if (els.periodo && snapshot.periodo) els.periodo.value = snapshot.periodo;
      if (els.municipio && snapshot.municipio !== undefined) els.municipio.value = snapshot.municipio;

      focosAtuais = Array.isArray(snapshot.focos) ? snapshot.focos : [];
      desenharFocos(focosAtuais);
      desenharEventosSnapshot(snapshot.eventos || { ativo: [], observacao: [] });

      rotaPontos = Array.isArray(snapshot.rota) ? snapshot.rota : [];
      salvarRotaLocal();
      desenharRotaPercorrida();

      if (snapshot.rotaAcesso && Array.isArray(snapshot.rotaAcesso.coords) && snapshot.rotaAcesso.coords.length >= 2) {
        rotaAcessoAtual = snapshot.rotaAcesso;
        layerRotaAcesso.clearLayers();
        criarLinhaRotaNavegavel(snapshot.rotaAcesso.coords, snapshot.rotaAcesso.titulo || "rota salva").addTo(layerRotaAcesso);
        atualizarBotoesNavegacaoInterna();
      }

      pontosOperacionais = Array.isArray(snapshot.pontosOperacionais) ? snapshot.pontosOperacionais : [];
      salvarPontosOperacionais();
      desenharPontosOperacionais();

      if (snapshot.alvoOperacional && Number.isFinite(snapshot.alvoOperacional.lat) && Number.isFinite(snapshot.alvoOperacional.lon)) {
        definirAlvoDoMapa(snapshot.alvoOperacional.lat, snapshot.alvoOperacional.lon, snapshot.alvoOperacional.titulo || "alvo salvo", snapshot.alvoOperacional.alvoId || "");
      }

      restaurarAceirosSnapshot(snapshot.aceiros || []);

      if (snapshot.center && Number.isFinite(snapshot.center.lat) && Number.isFinite(snapshot.center.lon)) {
        map.setView([snapshot.center.lat, snapshot.center.lon], Number(snapshot.zoom || map.getZoom()));
      }

      const data = new Date(snapshot.savedAt || Date.now()).toLocaleString("pt-BR");
      setStatus(`Sem internet: usando último estado salvo em ${data}. Área: ${snapshot.municipioTexto || "Goiás inteiro"}.`, "ok");
      return true;
    }

    function tentarCarregarOfflineSeSemInternet() {
      if (navigator.onLine === false) {
        setTimeout(() => carregarMapaOfflineSalvo(), 500);
        return true;
      }
      return false;
    }

    function abrirGpsPara(lat, lon) {
      const la = Number(lat);
      const lo = Number(lon);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) {
        alert("Coordenada inválida para guiar no GPS.");
        return;
      }

      const url = `https://www.google.com/maps/dir/?api=1&destination=${la.toFixed(6)},${lo.toFixed(6)}&travelmode=driving`;
      window.open(url, "_blank", "noopener,noreferrer");
    }

    function registrarAlvoEstradas(coords, titulo) {
      const pontos = (coords || [])
        .map(p => [Number(p[0]), Number(p[1])])
        .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));

      const id = "alvo_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      alvosEstradas.set(id, {
        coords: pontos,
        titulo: String(titulo || "foco/evento")
      });
      return id;
    }

    function centroDosPontos(coords) {
      const pontos = (coords || []).filter(p => Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])));
      if (!pontos.length) return null;

      const soma = pontos.reduce((acc, p) => {
        acc.lat += Number(p[0]);
        acc.lon += Number(p[1]);
        return acc;
      }, { lat: 0, lon: 0 });

      return [soma.lat / pontos.length, soma.lon / pontos.length];
    }

    function bboxPontosComBuffer(coords, bufferKm = 5) {
      const pontos = (coords || [])
        .map(p => [Number(p[0]), Number(p[1])])
        .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));

      if (!pontos.length) return null;

      const lats = pontos.map(p => p[0]);
      const lons = pontos.map(p => p[1]);
      const centroLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      const degLat = bufferKm / 111.32;
      const degLon = bufferKm / Math.max(20, 111.32 * Math.cos(centroLat * Math.PI / 180));

      let south = Math.min(...lats) - degLat;
      let north = Math.max(...lats) + degLat;
      let west = Math.min(...lons) - degLon;
      let east = Math.max(...lons) + degLon;

      // Proteção contra área enorme no Overpass.
      const maxAltura = 1.05;
      const maxLargura = 1.05;
      const midLat = (south + north) / 2;
      const midLon = (west + east) / 2;

      if ((north - south) > maxAltura) {
        south = midLat - maxAltura / 2;
        north = midLat + maxAltura / 2;
      }
      if ((east - west) > maxLargura) {
        west = midLon - maxLargura / 2;
        east = midLon + maxLargura / 2;
      }

      return { south, west, north, east };
    }

    function queryOverpassEstradas(bbox, modo = "basico") {
      const s = bbox.south.toFixed(6);
      const w = bbox.west.toFixed(6);
      const n = bbox.north.toFixed(6);
      const e = bbox.east.toFixed(6);

      if (modo === "basico") {
        return `[out:json][timeout:16];
(
  way["highway"](${s},${w},${n},${e});
);
(._;>;);
out body;`;
      }

      // Completo: além de estradas comuns, busca trilhas, carreiros, aceiros,
      // picadas, linhas de serviço e caminhos rurais que costumam aparecer finos no satélite.
      return `[out:json][timeout:25];
(
  way["highway"](${s},${w},${n},${e});
  way["highway"~"track|path|footway|bridleway|service|unclassified|tertiary|residential|living_street"](${s},${w},${n},${e});
  way["tracktype"](${s},${w},${n},${e});
  way["surface"](${s},${w},${n},${e});
  way["trail_visibility"](${s},${w},${n},${e});
  way["smoothness"](${s},${w},${n},${e});
  way["access"](${s},${w},${n},${e});
  way["service"](${s},${w},${n},${e});
  way["route"="road"](${s},${w},${n},${e});
  way["man_made"="cutline"](${s},${w},${n},${e});
  way["man_made"="track"](${s},${w},${n},${e});
  way["barrier"="firebreak"](${s},${w},${n},${e});
  way["firebreak"](${s},${w},${n},${e});
  way["natural"="firebreak"](${s},${w},${n},${e});
  way["landuse"="firebreak"](${s},${w},${n},${e});
);
(._;>;);
out body;`;
    }

    function distanciaPontoLinhaKm(lat, lon, coordsLinha) {
      let melhor = Infinity;

      for (let i = 0; i < coordsLinha.length - 1; i++) {
        const a = coordsLinha[i];
        const b = coordsLinha[i + 1];
        const d = distanciaPontoSegmentoKm(lat, lon, a[0], a[1], b[0], b[1]);
        if (d < melhor) melhor = d;
      }

      return melhor;
    }

    function distanciaAlvoLinhaKm(coordsAlvo, coordsLinha) {
      const alvo = (coordsAlvo || [])
        .map(p => [Number(p[0]), Number(p[1])])
        .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));

      if (!alvo.length || !coordsLinha.length) return Infinity;

      let melhor = Infinity;

      // Amostra para eventos grandes, evitando travar em polígonos/linhas muito longos.
      const passo = Math.max(1, Math.floor(alvo.length / 120));
      for (let i = 0; i < alvo.length; i += passo) {
        const p = alvo[i];
        const d = distanciaPontoLinhaKm(p[0], p[1], coordsLinha);
        if (d < melhor) melhor = d;
      }

      return melhor;
    }

    function bearingEntrePontosGraus(lat1, lon1, lat2, lon2) {
      const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
      const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
        Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
      return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    function pontoMedioLinha(coordsLinha) {
      if (!coordsLinha || !coordsLinha.length) return null;
      return coordsLinha[Math.floor(coordsLinha.length / 2)];
    }

    function setorDaLinhaEmRelacaoAoAlvo(coordsAlvo, coordsLinha) {
      const centro = centroDosPontos(coordsAlvo);
      const meio = pontoMedioLinha(coordsLinha);
      if (!centro || !meio) return 0;
      const graus = bearingEntrePontosGraus(centro[0], centro[1], meio[0], meio[1]);
      return Math.floor(graus / 45); // 8 setores em volta do fogo.
    }

    function limiteEstradasPorProximidade(candidatos, qtdPontosAlvo) {
      const limites = qtdPontosAlvo > 1
        ? [0.75, 1.5, 3, 5, 8, 12]
        : [0.35, 0.75, 1.5, 3, 5, 8, 12];

      for (const limite of limites) {
        const perto = candidatos.filter(c => c.distanciaKm <= limite);
        const setores = new Set(perto.map(c => c.setor)).size;

        // Para aceiro, tenta pegar vias em mais de um lado do fogo.
        if (perto.length >= 3 && setores >= 2) return limite;
        if (perto.length > 0 && limite >= 3) return limite;
      }

      return qtdPontosAlvo > 1 ? 12 : 8;
    }

    function estiloEstradaPorDistancia(highway, distanciaKm, tags = {}) {
      const tipo = String(highway || "").toLowerCase();
      const trilhaOuAceiro =
        tipo === "track" ||
        tipo === "path" ||
        tipo === "footway" ||
        tipo === "bridleway" ||
        tipo === "service" ||
        tags.tracktype ||
        tags.trail_visibility ||
        tags.firebreak ||
        tags.barrier === "firebreak" ||
        tags.natural === "firebreak" ||
        tags.landuse === "firebreak" ||
        tags.man_made === "cutline";

      // Cerco automático: azul/roxo para não confundir com a rota até o alvo.
      // Cerco manual permanece amarelo tracejado.
      if (trilhaOuAceiro) {
        return {
          color: "#b56cff",
          weight: distanciaKm < 1 ? 7 : 6,
          opacity: 0.98,
          dashArray: "7 8",
          pane: "paneEstradas"
        };
      }

      if (tipo === "primary" || tipo === "secondary" || tipo === "trunk") {
        return {
          color: "#2f80ff",
          weight: distanciaKm < 1 ? 7 : 6,
          opacity: 0.96,
          dashArray: "",
          pane: "paneEstradas"
        };
      }

      if (tipo === "tertiary" || tipo === "unclassified" || tipo === "residential" || tipo === "living_street") {
        return {
          color: "#38b6ff",
          weight: distanciaKm < 1 ? 6 : 5,
          opacity: 0.96,
          dashArray: "12 8",
          pane: "paneEstradas"
        };
      }

      return {
        color: "#5ee7ff",
        weight: distanciaKm < 1 ? 5 : 4,
        opacity: 0.9,
        dashArray: "9 9",
        pane: "paneEstradas"
      };
    }

    function nomeTipoEstrada(tags = {}) {
      const nome = tags.name || tags.ref || "Estrada/trilha sem nome";
      const tipo = tags.highway ? ` (${tags.highway})` : "";
      const superficie = tags.surface ? ` · piso: ${tags.surface}` : "";
      const acesso = tags.access ? ` · acesso: ${tags.access}` : "";
      return `${nome}${tipo}${superficie}${acesso}`;
    }

    async function fetchOverpassEstradas(query, timeoutMs = 13000) {
      let ultimoErro = null;

      if (!DEBUG_CERCO_ULTIMO || !Array.isArray(DEBUG_CERCO_ULTIMO.overpass)) {
        DEBUG_CERCO_ULTIMO = {
          motivo: "fetchOverpassEstradas",
          tentativas: [],
          overpass: [],
          desenho: null,
          erro: null,
          alvoId: null,
          alvo: null
        };
      }

      DEBUG_CERCO_ULTIMO.overpass.push({
        etapa: "inicio",
        hora: new Date().toLocaleString("pt-BR"),
        timeoutMs,
        queryPreview: String(query || "").slice(0, 1200)
      });

      for (const endpoint of OVERPASS_ENDPOINTS) {
        const inicio = Date.now();
        try {
          const resp = await fetchComTimeout(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: "data=" + encodeURIComponent(query)
          }, timeoutMs);

          const ms = Date.now() - inicio;

          if (!resp.ok) throw new Error("HTTP " + resp.status);

          const json = await resp.json();
          const resumo = resumoElementosOverpass(json);

          DEBUG_CERCO_ULTIMO.overpass.push({
            etapa: "sucesso",
            hora: new Date().toLocaleString("pt-BR"),
            endpoint,
            ms,
            resumo
          });

          return json;
        } catch (err) {
          ultimoErro = err;
          const ms = Date.now() - inicio;

          DEBUG_CERCO_ULTIMO.overpass.push({
            etapa: "erro",
            hora: new Date().toLocaleString("pt-BR"),
            endpoint,
            ms,
            erro: err && err.message ? err.message : String(err)
          });
        }
      }

      throw ultimoErro || new Error("Falha ao consultar Overpass.");
    }

    function desenharEstradasOverpass(json, titulo, coordsAlvo = [], alvoId = null) {
      const elementos = Array.isArray(json && json.elements) ? json.elements : [];
      const nodes = new Map();

      elementos.forEach(el => {
        if (el.type === "node" && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
          nodes.set(el.id, [el.lat, el.lon]);
        }
      });

      const candidatos = [];

      elementos.forEach(el => {
        if (el.type !== "way" || !Array.isArray(el.nodes)) return;

        const coords = el.nodes.map(id => nodes.get(id)).filter(Boolean);
        if (coords.length < 2) return;

        const distanciaKm = distanciaAlvoLinhaKm(coordsAlvo, coords);
        if (!Number.isFinite(distanciaKm)) return;

        const tags = el.tags || {};
        const highway = tags.highway || "";
        const tipo = String(highway || "").toLowerCase();
        const isTrilha =
          tipo === "track" ||
          tipo === "path" ||
          tipo === "footway" ||
          tipo === "bridleway" ||
          tipo === "service" ||
          tags.tracktype ||
          tags.trail_visibility ||
          tags.firebreak ||
          tags.barrier === "firebreak" ||
          tags.natural === "firebreak" ||
          tags.landuse === "firebreak" ||
          tags.man_made === "cutline";

        candidatos.push({
          el,
          coords,
          distanciaKm,
          setor: setorDaLinhaEmRelacaoAoAlvo(coordsAlvo, coords),
          highway,
          tags,
          isTrilha
        });
      });

      candidatos.sort((a, b) => a.distanciaKm - b.distanciaKm);

      const selecionadosMap = new Map();

      candidatos
        .filter(c => c.distanciaKm <= 2.3)
        .forEach(c => selecionadosMap.set(c.el.id, c));

      candidatos
        .filter(c => c.isTrilha && c.distanciaKm <= 3.5)
        .forEach(c => selecionadosMap.set(c.el.id, c));

      for (let setor = 0; setor < 8; setor++) {
        candidatos
          .filter(c => c.setor === setor && c.distanciaKm <= 4.5)
          .slice(0, 8)
          .forEach(c => selecionadosMap.set(c.el.id, c));
      }

      let selecionados = [...selecionadosMap.values()]
        .sort((a, b) => a.distanciaKm - b.distanciaKm)
        .slice(0, 260);

      const grupoAlvo = L.layerGroup();
      let total = 0;
      const bounds = L.latLngBounds([]);

      selecionados.forEach(c => {
        const linha = L.polyline(
          c.coords,
          Object.assign({}, estiloEstradaPorDistancia(c.highway, c.distanciaKm, c.tags), {
            interactive: false
          })
        );

        linha.addTo(grupoAlvo);
        c.coords.forEach(p => bounds.extend(p));
        total++;
      });

      (coordsAlvo || []).slice(0, 160).forEach(p => {
        if (!Number.isFinite(Number(p[0])) || !Number.isFinite(Number(p[1]))) return;
        bounds.extend([Number(p[0]), Number(p[1])]);
      });

      if (total && alvoId) {
        if (estradasCamadasPorAlvo.has(alvoId)) {
          layerEstradasDestaque.removeLayer(estradasCamadasPorAlvo.get(alvoId));
        }
        estradasCamadasPorAlvo.set(alvoId, grupoAlvo);
        grupoAlvo.addTo(layerEstradasDestaque);
      }

      if (total && bounds.isValid()) {
        map.fitBounds(bounds.pad(0.22), { maxZoom: 16, animate: true });
      }

      const desenho = {
        titulo,
        alvoId,
        totalElementos: elementos.length,
        totalNodes: nodes.size,
        totalWays: elementos.filter(e => e.type === "way").length,
        totalCandidatos: candidatos.length,
        totalAte2_3Km: candidatos.filter(c => c.distanciaKm <= 2.3).length,
        totalTrilhasAte3_5Km: candidatos.filter(c => c.isTrilha && c.distanciaKm <= 3.5).length,
        totalSelecionados: selecionados.length,
        totalDesenhado: total,
        observacao: "Somente linhas reais recebidas do Overpass/OpenStreetMap. Linhas visíveis apenas no satélite devem ser marcadas pelo aceiro manual assistido.",
        boundsValido: bounds.isValid(),
        candidatosMaisProximos: candidatos.slice(0, 60).map(c => ({
          id: c.el.id,
          distanciaKm: Number(c.distanciaKm.toFixed(4)),
          setor: c.setor,
          highway: c.highway || null,
          isTrilha: !!c.isTrilha,
          name: c.tags.name || c.tags.ref || null,
          surface: c.tags.surface || null,
          tracktype: c.tags.tracktype || null,
          trail_visibility: c.tags.trail_visibility || null,
          firebreak: c.tags.firebreak || c.tags.barrier || c.tags.natural || c.tags.landuse || null,
          man_made: c.tags.man_made || null,
          nodes: c.coords.length
        })),
        selecionadosPreview: selecionados.slice(0, 80).map(c => ({
          id: c.el.id,
          distanciaKm: Number(c.distanciaKm.toFixed(4)),
          setor: c.setor,
          highway: c.highway || null,
          isTrilha: !!c.isTrilha,
          name: c.tags.name || c.tags.ref || null,
          nodes: c.coords.length
        })),
        layerEstradasDestaqueLayers: layerEstradasDestaque && layerEstradasDestaque.getLayers ? layerEstradasDestaque.getLayers().length : null,
        estradasCamadasPorAlvoSize: estradasCamadasPorAlvo && estradasCamadasPorAlvo.size
      };

      if (typeof DEBUG_CERCO_ULTIMO !== "undefined") DEBUG_CERCO_ULTIMO.desenho = desenho;
      if (typeof registrarLogCerco === "function") registrarLogCerco("desenhar-estradas-overpass", desenho);

      return total;
    }

    function mostrarControlesAceiroManual(show) {
      // Controles flutuantes de aceiro removidos da interface.
    }

    function limparTemporarioAceiroManual() {
      layerAceiroManualTemp.clearLayers();
      if (aceiroManualLinhaTemp) {
        map.removeLayer(aceiroManualLinhaTemp);
        aceiroManualLinhaTemp = null;
      }
    }

    function atualizarDesenhoAceiroManual() {
      limparTemporarioAceiroManual();

      aceiroManualPontos.forEach((p) => {
        L.marker(p, {
          icon: L.divIcon({
            className: "",
            html: '<div class="aceiro-manual-point"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          }),
          pane: "paneEstradas",
          interactive: false
        }).addTo(layerAceiroManualTemp);
      });

      if (aceiroManualPontos.length >= 2) {
        aceiroManualLinhaTemp = L.polyline(aceiroManualPontos, {
          color: "#ffe95c",
          weight: 8,
          opacity: 1,
          dashArray: "8 7",
          pane: "paneEstradas",
          interactive: false
        }).addTo(map);
      }
    }

    function iniciarAceiroManual(alvoId) {
      const alvo = alvosEstradas.get(alvoId);
      if (!alvo) {
        alert("Não foi possível encontrar este foco/evento.");
        return;
      }

      aceiroManualAtivo = true;
      aceiroManualAlvoId = alvoId;
      aceiroManualPontos = [];
      limparTemporarioAceiroManual();
      mostrarControlesAceiroManual(true);

      // Mantém o painel aberto para finalizar a marcação manual.
      try { map.closePopup(); } catch (_) {}

      if (map && map.getContainer) {
        map.getContainer().classList.add("crosshair");
      }

      atualizarBotoesPainelFoco();
      setStatus("Cerco manual iniciado. Clique no mapa ponto a ponto. O botão Parar marcação ficou aberto no painel.", "ok");
    }

    function adicionarPontoAceiroManual(latlng) {
      if (!aceiroManualAtivo) return;

      aceiroManualPontos.push([latlng.lat, latlng.lng]);
      atualizarDesenhoAceiroManual();

      const total = aceiroManualPontos.length;
      atualizarBotoesPainelFoco();
      setStatus(`Ponto ${total} do cerco manual marcado. Continue clicando na trilha ou use Parar marcação no painel.`, "ok");
    }

    function desfazerPontoAceiroManual() {
      if (!aceiroManualAtivo || !aceiroManualPontos.length) return;
      aceiroManualPontos.pop();
      atualizarDesenhoAceiroManual();

      

    }

    function cancelarAceiroManual() {
      aceiroManualAtivo = false;
      aceiroManualAlvoId = null;
      aceiroManualPontos = [];
      limparTemporarioAceiroManual();
      mostrarControlesAceiroManual(false);
      if (map && map.getContainer) {
        map.getContainer().classList.remove("crosshair");
      }
      atualizarStatusAceiro();
      atualizarBotoesPainelFoco();
    }

    function finalizarAceiroManual() {
      if (!aceiroManualAtivo && aceiroManualPontos.length < 2) return false;

      if (aceiroManualPontos.length < 2) {
        aceiroManualAtivo = false;
        aceiroManualAlvoId = null;
        if (map && map.getContainer) {
          map.getContainer().classList.remove("crosshair");
        }
        mostrarControlesAceiroManual(false);
        atualizarBotoesPainelFoco();
        setStatus("Marcação manual parada. Marque pelo menos 2 pontos para formar uma linha.", "warn");
        return false;
      }

      const alvoId = aceiroManualAlvoId || ("manual_" + (++aceiroManualSequencia));
      const idManual = alvoId + "_manual_" + (++aceiroManualSequencia);
      const grupo = L.layerGroup();
      const totalPontos = aceiroManualPontos.length;

      const abrirOpcoesCercoManual = (ev = null) => {
        try {
          if (ev && ev.originalEvent) {
            ev.originalEvent.preventDefault();
            ev.originalEvent.stopPropagation();
          }
        } catch (_) {}

        abrirPainelCercoManualOpcoes(idManual, totalPontos);
        setStatus("Cerco manual selecionado. Use Remover cerco manual para apagar.", "ok");
      };

      const linhaVisual = L.polyline(aceiroManualPontos, {
        color: "#fffb8a",
        weight: 9,
        opacity: 1,
        dashArray: "8 7",
        pane: "paneEstradas",
        interactive: true,
        bubblingMouseEvents: false
      });

      const linhaClique = L.polyline(aceiroManualPontos, {
        color: "#ffffff",
        weight: 34,
        opacity: 0.01,
        pane: "paneEstradas",
        interactive: true,
        bubblingMouseEvents: false
      });

      linhaVisual.on("click", abrirOpcoesCercoManual);
      linhaClique.on("click", abrirOpcoesCercoManual);
      linhaVisual.on("touchstart", abrirOpcoesCercoManual);
      linhaClique.on("touchstart", abrirOpcoesCercoManual);

      linhaVisual.addTo(grupo);
      linhaClique.addTo(grupo);
      grupo.addTo(layerEstradasDestaque);
      estradasCamadasPorAlvo.set(idManual, grupo);

      aceiroManualAtivo = false;
      aceiroManualAlvoId = null;
      aceiroManualPontos = [];
      limparTemporarioAceiroManual();
      mostrarControlesAceiroManual(false);

      if (map && map.getContainer) {
        map.getContainer().classList.remove("crosshair");
      }

      atualizarStatusAceiro("Cerco manual adicionado.");
      atualizarBotoesPainelFoco();
      atualizarBotaoCerco();
      setStatus("Cerco manual salvo. Clique na linha amarela para abrir Remover cerco manual.", "ok");
      agendarSalvamentoOfflineAutomatico();
      return true;
    }

    function removerCercoManual(idManual) {
      const id = String(idManual || "");
      const grupo = estradasCamadasPorAlvo.get(id);

      if (grupo) {
        try { layerEstradasDestaque.removeLayer(grupo); } catch (_) {}
        estradasCamadasPorAlvo.delete(id);
      }

      fecharPainelCercoManualOpcoes();
      try { map.closePopup(); } catch (_) {}

      atualizarStatusAceiro("Cerco manual removido.");
      atualizarBotoesPainelFoco();
      atualizarBotaoCerco();
      setStatus("Cerco manual removido.", "ok");
      agendarSalvamentoOfflineAutomatico();
    }

    function totalAceirosAtivos() {
      let total = 0;
      estradasCamadasPorAlvo.forEach(g => total += g.getLayers().length);
      return total;
    }

    function atualizarStatusAceiro(textoExtra = "") {
    }

    function removerAceiroDoAlvo(alvoId) {
      const grupo = estradasCamadasPorAlvo.get(alvoId);
      if (grupo) {
        layerEstradasDestaque.removeLayer(grupo);
        estradasCamadasPorAlvo.delete(alvoId);
      }
      if (estradasAlvoAtualId === alvoId) estradasAlvoAtualId = null;
      atualizarStatusAceiro();
    }

    async function destacarEstradasDoAlvo(alvoId, opcoes = {}) {
      const alvo = alvosEstradas.get(alvoId);
      if (!alvo || !alvo.coords.length) {
        registrarLogCerco("destacar-sem-alvo", { alvoId, existe: !!alvo });
        alert("Não foi possível encontrar as coordenadas deste foco/evento.");
        return 0;
      }

      const naoAlternar = !!(opcoes && opcoes.naoAlternar);
      const silencioso = !!(opcoes && opcoes.silencioso);

      DEBUG_CERCO_ULTIMO = {
        motivo: "destacarEstradasDoAlvo",
        tentativas: [],
        overpass: [],
        desenho: null,
        erro: null,
        alvoId,
        alvo: {
          titulo: alvo.titulo,
          totalCoords: alvo.coords.length,
          coordsPreview: alvo.coords.slice(0, 12)
        },
        atualizadoEm: new Date().toLocaleString("pt-BR")
      };

      registrarLogCerco("destacar-inicio", {
        alvoId,
        titulo: alvo.titulo,
        totalCoords: alvo.coords.length,
        naoAlternar,
        silencioso,
        jaTemEstradas: estradasCamadasPorAlvo.has(alvoId)
      });

      if (estradasCamadasPorAlvo.has(alvoId)) {
        if (!naoAlternar) {
          removerAceiroDoAlvo(alvoId);
          if (!silencioso) setStatus("Aceiro/estradas do foco removidos.", "ok");
          registrarLogCerco("destacar-removeu-existente", { alvoId });
          return 0;
        }
        registrarLogCerco("destacar-ja-existente-nao-alternar", { alvoId, totalAceiros: totalAceirosAtivos() });
        return totalAceirosAtivos();
      }

      estradasAlvoAtualId = alvoId;

      const tentativas = [
        { nome: "trilhas, aceiros, carreiros, trieiros e estradas pequenas", buffer: alvo.coords.length > 1 ? 12 : 8, modo: "completo", timeout: 22000 },
        { nome: "vias próximas de fallback", buffer: alvo.coords.length > 1 ? 8 : 5, modo: "basico", timeout: 14000 }
      ];

      try {
        for (let i = 0; i < tentativas.length; i++) {
          const tentativa = tentativas[i];
          const bbox = bboxPontosComBuffer(alvo.coords, tentativa.buffer);

          const tentativaLog = {
            indice: i,
            tentativa,
            bbox,
            queryPreview: null,
            totalDesenhado: null,
            erro: null
          };
          DEBUG_CERCO_ULTIMO.tentativas.push(tentativaLog);

          registrarLogCerco("destacar-tentativa", { alvoId, indice: i, tentativa, bbox });

          if (!bbox) {
            tentativaLog.erro = "bbox vazio";
            registrarLogCerco("destacar-bbox-vazio", { alvoId, indice: i });
            alert("Não foi possível calcular a área de busca das estradas.");
            return 0;
          }

          if (!silencioso) setStatus(`Buscando ${tentativa.nome} para cercar o fogo...`, "warn");

          const query = queryOverpassEstradas(bbox, tentativa.modo);
          tentativaLog.queryPreview = String(query || "").slice(0, 2500);

          const json = await fetchOverpassEstradas(query, tentativa.timeout);
          const total = desenharEstradasOverpass(json, alvo.titulo, alvo.coords, alvoId);
          tentativaLog.totalDesenhado = total;

          registrarLogCerco("destacar-total-tentativa", {
            alvoId,
            indice: i,
            total,
            resumoOverpass: resumoElementosOverpass(json),
            desenho: DEBUG_CERCO_ULTIMO.desenho
          });

          if (total > 0) {
            if (!silencioso) setStatus(`Cerco automático criado: raios + ${total} estrada(s)/trilha(s)/aceiro(s) vindos do mapa de dados.`, "ok");
            atualizarBotoesPainelFoco();
            agendarSalvamentoOfflineAutomatico(500, true);
            return total;
          }
        }

        if (!silencioso) setStatus("Raios do cerco criados, mas não encontrei estradas/trilhas/aceiros próximos nessa área.", "warn");
        registrarLogCerco("destacar-sem-resultado-final", { alvoId, tentativas: DEBUG_CERCO_ULTIMO.tentativas });
        return 0;
      } catch (err) {
        estradasAlvoAtualId = null;
        DEBUG_CERCO_ULTIMO.erro = err && err.stack ? err.stack : String(err);
        registrarLogCerco("destacar-erro-final", {
          alvoId,
          erro: err && err.stack ? err.stack : String(err),
          tentativas: DEBUG_CERCO_ULTIMO.tentativas,
          overpass: DEBUG_CERCO_ULTIMO.overpass
        });

        if (!silencioso) setStatus(`Raios do cerco criados. Falha ao buscar estradas/trilhas/aceiros: ${escapeHtml(err && err.message ? err.message : String(err))}`, "warn");
        return 0;
      }
    }

    function limparEstradasDestaque() {
      layerEstradasDestaque.clearLayers();
      estradasCamadasPorAlvo.clear();
      estradasAlvoAtualId = null;
      aceiroManualAtivo = false;
      aceiroManualAlvoId = null;
      aceiroManualPontos = [];
      limparTemporarioAceiroManual();
      mostrarControlesAceiroManual(false);
      atualizarStatusAceiro();
    }

    function escapeJsTexto(texto) {
      return String(texto || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\r?\n/g, " ");
    }

    function atualizarPainelOperacional() {
      if (!els.operacaoAlvoNome) return;

      if (!alvoOperacionalAtual) {
        els.operacaoAlvoNome.textContent = "Nenhum foco/evento definido como alvo.";
        if (els.operacaoDistancia) els.operacaoDistancia.textContent = "--";
        if (els.operacaoRumo) els.operacaoRumo.textContent = "--";
        if (els.operacaoGps) els.operacaoGps.textContent = ultimaLocalizacao ? `±${Math.round(ultimaLocalizacao.accuracy || 0)} m` : "--";
        return;
      }

      els.operacaoAlvoNome.textContent = alvoOperacionalAtual.titulo || "Alvo operacional";

      if (ultimaLocalizacao) {
        const km = distanciaKm(ultimaLocalizacao.lat, ultimaLocalizacao.lon, alvoOperacionalAtual.lat, alvoOperacionalAtual.lon);
        const rumo = bearingGraus(ultimaLocalizacao.lat, ultimaLocalizacao.lon, alvoOperacionalAtual.lat, alvoOperacionalAtual.lon);
        if (els.operacaoDistancia) els.operacaoDistancia.textContent = formatarDistanciaOperacional(km);
        if (els.operacaoRumo) els.operacaoRumo.textContent = `${Math.round(rumo)}° ${direcaoCardinal(rumo)}`;
        if (els.operacaoGps) els.operacaoGps.textContent = `±${Math.round(ultimaLocalizacao.accuracy || 0)} m`;
      } else {
        if (els.operacaoDistancia) els.operacaoDistancia.textContent = "--";
        if (els.operacaoRumo) els.operacaoRumo.textContent = "--";
        if (els.operacaoGps) els.operacaoGps.textContent = "--";
      }
    }

    function focoEstaComoAlvo(alvoId, lat, lon) {
      if (!alvoOperacionalAtual) return false;

      const id = String(alvoId || "");
      if (id && String(alvoOperacionalAtual.alvoId || "") === id) return true;

      const la = Number(lat);
      const lo = Number(lon);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;

      return Math.abs(Number(alvoOperacionalAtual.lat) - la) < 0.000001 &&
             Math.abs(Number(alvoOperacionalAtual.lon) - lo) < 0.000001;
    }

    function cercoAutomaticoAtivoDoFoco(alvoId, lat, lon) {
      return focoEstaComoAlvo(alvoId, lat, lon) &&
             layerAreaAcao &&
             layerAreaAcao.getLayers &&
             layerAreaAcao.getLayers().length > 0;
    }

    function aceiroManualAtivoDoFoco(alvoId) {
      return !!(aceiroManualAtivo && String(aceiroManualAlvoId || "") === String(alvoId || ""));
    }

    function atualizarBotoesPainelFoco() {
      if (!els.painelFocoConteudo) return;

      const botoes = els.painelFocoConteudo.querySelectorAll("[data-foco-action]");
      botoes.forEach((btn) => {
        const action = btn.getAttribute("data-foco-action");
        const alvoId = btn.getAttribute("data-alvo-id") || "";
        const lat = Number(btn.getAttribute("data-lat"));
        const lon = Number(btn.getAttribute("data-lon"));

        if (action === "alvo") {
          const ativo = focoEstaComoAlvo(alvoId, lat, lon);
          btn.textContent = ativo ? "Remover alvo" : "Definir como alvo";
          btn.classList.toggle("active-toggle", ativo);
        }

        if (action === "cerco") {
          const ativo = cercoAutomaticoAtivoDoFoco(alvoId, lat, lon);
          btn.textContent = ativo ? "Remover cerco automático" : "Cerco automático";
          btn.classList.toggle("active-toggle", ativo);
        }

        if (action === "aceiro-manual") {
          const ativo = aceiroManualAtivoDoFoco(alvoId);
          btn.textContent = ativo ? "Parar marcação" : "Marcar cerco manual";
          btn.classList.toggle("active-toggle", ativo);
        }
      });
    }

    function alternarAlvoDoFoco(alvoId, lat, lon, titulo = "foco/evento") {
      if (focoEstaComoAlvo(alvoId, lat, lon)) {
        limparAlvoOperacional();
      } else {
        definirAlvoDoMapa(lat, lon, titulo, alvoId);
      }
      atualizarBotoesPainelFoco();
    }

    async function alternarCercoAutomaticoDoFoco(alvoId, lat, lon, titulo = "foco/evento") {
      registrarLogCerco("botao-cerco-clicado", {
        alvoId,
        lat,
        lon,
        titulo,
        cercoAtivo: cercoAutomaticoAtivoDoFoco(alvoId, lat, lon),
        temEstradas: estradasCamadasPorAlvo.has(alvoId),
        alvoOperacionalAtual
      });

      if (cercoAutomaticoAtivoDoFoco(alvoId, lat, lon) || estradasCamadasPorAlvo.has(alvoId)) {
        layerAreaAcao.clearLayers();
        removerAceiroDoAlvo(alvoId);
        atualizarBotaoCerco();
        atualizarBotoesPainelFoco();
        setStatus("Cerco automático removido deste foco/evento.", "ok");
        agendarSalvamentoOfflineAutomatico();
        registrarLogCerco("botao-cerco-removeu", { alvoId });
        return;
      }

      if (!focoEstaComoAlvo(alvoId, lat, lon)) {
        definirAlvoDoMapa(lat, lon, titulo, alvoId);
      }

      if (layerAreaAcao && layerAreaAcao.getLayers && layerAreaAcao.getLayers().length > 0) {
        layerAreaAcao.clearLayers();
      }

      removerAceiroDoAlvo(alvoId);

      try {
        desenharAreaAcaoAlvo();
      } catch (err) {
        console.warn("Erro ao desenhar raios do cerco:", err);
      }

      atualizarBotaoCerco();
      atualizarBotoesPainelFoco();

      setStatus("Buscando estradas/trilhas/aceiros do cerco automático...", "warn");

      try {
        const total = await destacarEstradasDoAlvo(alvoId, { naoAlternar: true });
        if (!total) {
          setStatus("Raios criados, mas nenhuma estrada/trilha/aceiro do mapa de dados foi encontrada perto do foco.", "warn");
        }
      } catch (err) {
        console.warn("Erro no cerco automático:", err);
        setStatus("Raios criados, mas falhou a busca de estradas/trilhas/aceiros. Verifique a internet e tente de novo.", "warn");
      }

      atualizarBotaoCerco();
      atualizarBotoesPainelFoco();
    }

    function alternarAceiroManualDoFoco(alvoId) {
      if (aceiroManualAtivo && String(aceiroManualAlvoId || "") === String(alvoId || "")) {
        finalizarAceiroManual();
        return;
      }

      iniciarAceiroManual(alvoId);
      atualizarBotoesPainelFoco();
    }

    function botoesAcaoMapa(lat, lon, alvoId, titulo = "foco/evento") {
      const la = Number(lat).toFixed(6);
      const lo = Number(lon).toFixed(6);
      const id = escapeJsTexto(alvoId);
      const tit = escapeJsTexto(titulo);
      const alvoAtivo = focoEstaComoAlvo(alvoId, lat, lon);
      const cercoAtivo = cercoAutomaticoAtivoDoFoco(alvoId, lat, lon);
      const marcacaoAtiva = aceiroManualAtivoDoFoco(alvoId);

      return `<div class="popup-actions">` +
        `<button type="button" data-foco-action="alvo" data-alvo-id="${escapeHtml(alvoId)}" data-lat="${la}" data-lon="${lo}" onclick="alternarAlvoDoFoco('${id}', ${la}, ${lo}, '${tit}')">${alvoAtivo ? "Remover alvo" : "Definir como alvo"}</button>` +
        `<button type="button" data-foco-action="cerco" data-alvo-id="${escapeHtml(alvoId)}" data-lat="${la}" data-lon="${lo}" onclick="alternarCercoAutomaticoDoFoco('${id}', ${la}, ${lo}, '${tit}')">${cercoAtivo ? "Remover cerco automático" : "Cerco automático"}</button>` +
        `<button type="button" onclick="abrirGpsPara(${la}, ${lo})">Abrir no GPS externo</button>` +
        `<button type="button" class="secondary" data-foco-action="aceiro-manual" data-alvo-id="${escapeHtml(alvoId)}" data-lat="${la}" data-lon="${lo}" onclick="alternarAceiroManualDoFoco('${id}')">${marcacaoAtiva ? "Parar marcação" : "Marcar cerco manual"}</button>` +
      `</div>`;
    }

    let eventosDebugLog = [];
    let eventosDebugExecucao = null;
    let eventosMapaBounds = null;
    let eventosMapaTotal = 0;
    let eventosMapaAtivos = 0;
    let eventosMapaObservacao = 0;

    function logEventoDebug(mensagem, dados = null) {
    }

    function resetarEventosMapaResumo() {
      eventosMapaBounds = null;
      eventosMapaTotal = 0;
      eventosMapaAtivos = 0;
      eventosMapaObservacao = 0;
      if (els.eventosResumoMapa) {
        els.eventosResumoMapa.textContent = "Eventos no mapa: atualizando...";
      }
    }

    function registrarEventoNoMapa(latlngs, tipo) {
      const pontos = Array.isArray(latlngs[0]) ? latlngs : [latlngs];

      pontos.forEach((p) => {
        const lat = Number(p[0]);
        const lon = Number(p[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        if (!eventosMapaBounds) eventosMapaBounds = L.latLngBounds([[lat, lon]]);
        else eventosMapaBounds.extend([lat, lon]);
      });

      eventosMapaTotal++;
      if (tipo === "ativo") eventosMapaAtivos++;
      else eventosMapaObservacao++;
    }

    function atualizarResumoEventosMapa() {
      if (!els.eventosResumoMapa) return;

      if (!eventosMapaTotal) {
        els.eventosResumoMapa.textContent = "Eventos no mapa: nenhum evento visível para o período/filtro atual.";
        return;
      }

      els.eventosResumoMapa.textContent =
        `Eventos no mapa: ${eventosMapaTotal} geometria(s) · ${eventosMapaAtivos} ativa(s) · ${eventosMapaObservacao} em observação. Use “Ir para eventos”.`;
    }

    function irParaEventosMapa() {
      if (!eventosMapaBounds || !eventosMapaTotal) {
        alert("Nenhum evento visível no mapa para o período/filtro atual.");
        return;
      }

      map.fitBounds(eventosMapaBounds.pad(0.35), {
        maxZoom: 13,
        animate: true
      });
    }

    function abrirPopupEvento(layer, popup, ev = null) {
      if (!layer) return false;

      try {
        if (ev && ev.originalEvent) {
          ev.originalEvent.preventDefault();
          ev.originalEvent.stopPropagation();
        }
      } catch (_) {}

      const abriuPainel = abrirPainelEventoOpcoes(popup);
      if (abriuPainel) {
        return true;
      }

      try {
        if (!layer.getPopup || !layer.getPopup()) {
          layer.bindPopup(popup, {
            maxWidth: 520,
            minWidth: 320,
            autoPan: true,
            closeButton: true,
            autoPanPadding: [40, 120],
            className: "evento-popup-leaflet"
          });
        }

        if (ev && ev.latlng && typeof layer.openPopup === "function") {
          layer.openPopup(ev.latlng);
        } else if (typeof layer.openPopup === "function") {
          layer.openPopup();
        }

        setStatus("Evento selecionado. As informações foram abertas no mapa.", "ok");
        return true;
      } catch (_) {
        return false;
      }
    }

    function configurarCamadaEventoClicavel(layer, popup) {
      if (!layer) return layer;

      layer.bindPopup(popup, {
        maxWidth: 520,
        minWidth: 320,
        autoPan: true,
        closeButton: true,
        autoPanPadding: [40, 120],
        className: "evento-popup-leaflet"
      });

      layer.on("click", (ev) => abrirPopupEvento(layer, popup, ev));
      layer.on("touchstart", (ev) => abrirPopupEvento(layer, popup, ev));

      return layer;
    }

    function marcadorDestaqueEvento(lat, lon, tipo, popup) {
      const layerDestino = tipo === "ativo" ? layerEventosAtivos : layerEventosObservacao;
      const classe = tipo === "ativo" ? "ativo" : "observacao";
      const titulo = tipo === "ativo" ? "Evento ativo" : "Evento em observação";

      const marker = L.marker([lat, lon], {
        icon: L.divIcon({
          className: "evento-info-div-icon",
          html: `<div class="evento-info-marker ${classe}" role="button" tabindex="0" title="${titulo}" aria-label="Abrir informações do ${titulo}">i</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
          popupAnchor: [0, -12]
        }),
        pane: "paneFocos",
        interactive: true,
        keyboard: false,
        bubblingMouseEvents: false,
        riseOnHover: true,
        zIndexOffset: 8000
      });

      configurarCamadaEventoClicavel(marker, popup);
      marker.addTo(layerDestino);
      return marker;
    }

    function iniciarDebugEventos(tipo, label, horas) {
      eventosDebugExecucao = {
        tipo,
        label,
        horas: Number(horas || (els.periodo ? els.periodo.value : 24)),
        filtro: textoFiltroCidade() || "Goiás inteiro",
        placemarks: 0,
        desenhadas: 0,
        filtradasPeriodo: 0,
        semUltimoFoco: 0,
        comUltimoFoco: 0,
        foraArea: 0,
        semGeometria: 0,
        erros: 0
      };

      logEventoDebug(`Iniciando ${label}`, {
        periodoHoras: eventosDebugExecucao.horas,
        filtro: eventosDebugExecucao.filtro
      });
    }

    function finalizarDebugEventos(totalKml) {
      if (!eventosDebugExecucao) return;

      logEventoDebug(`Resumo ${eventosDebugExecucao.label}`, {
        periodoHoras: eventosDebugExecucao.horas,
        filtro: eventosDebugExecucao.filtro,
        placemarksNoKml: totalKml,
        placemarksProcessados: eventosDebugExecucao.placemarks,
        geometriasDesenhadas: eventosDebugExecucao.desenhadas,
        filtradasPeloPeriodo: eventosDebugExecucao.filtradasPeriodo,
        comUltimoFocoIdentificado: eventosDebugExecucao.comUltimoFoco,
        semUltimoFocoIdentificado: eventosDebugExecucao.semUltimoFoco,
        foraDaAreaOuCidade: eventosDebugExecucao.foraArea,
        semGeometriaValida: eventosDebugExecucao.semGeometria,
        erros: eventosDebugExecucao.erros
      });

      eventosDebugExecucao = null;
    }

    function limitarZoomMinimoGoias(bounds) {
      if (!bounds) return;

      goiasViewBounds = bounds;

      // Mantém o zoom mínimo próximo do necessário para mostrar Goiás inteiro,
      // evitando afastar demais do estado.
      const zoomParaGoiasInteiro = map.getBoundsZoom(bounds, false, [20, 20]);
      const zoomMinimo = Math.max(5, zoomParaGoiasInteiro - 1);

      map.setMinZoom(zoomMinimo);

      if (map.getZoom() < zoomMinimo) {
        map.setZoom(zoomMinimo);
      }
    }

    function zoomGoias() {
      const bounds = goiasViewBounds || GOIAS_BOUNDS;
      map.fitBounds(bounds, { padding: [20, 20] });
      limitarZoomMinimoGoias(bounds);
    }

    function nomeMunicipioFeature(feature) {
      const p = feature && feature.properties ? feature.properties : {};
      return String(
        p.name || p.nome || p.NM_MUN || p.NM_MUNICIP || p.nome_mun ||
        p.MUNICIPIO || p.municipio || p.description || ""
      ).trim();
    }

    function idMunicipioFeature(feature, fallbackIndex) {
      const p = feature && feature.properties ? feature.properties : {};
      return String(
        p.id || p.ID || p.CD_MUN || p.CD_MUNICIP || p.codarea ||
        p.geocodigo || p.codigo_ibg || p.cod_ibge || p.GEOCODIGO ||
        nomeMunicipioFeature(feature) || fallbackIndex
      ).trim();
    }

    async function carregarGeojsonMunicipios(url) {
      const resp = await fetchComTimeout(url, { cache: "force-cache", mode: "cors" }, 16000);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return await resp.json();
    }

    async function carregarNomesMunicipiosIbge() {
      const nomes = new Map();

      try {
        const resp = await fetchComTimeout(GOIAS_MUNICIPIOS_NOMES_URL, { cache: "force-cache", mode: "cors" }, 14000);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const lista = await resp.json();

        if (Array.isArray(lista)) {
          lista.forEach((m) => {
            if (m && m.id && m.nome) nomes.set(String(m.id), String(m.nome));
          });
        }
      } catch (_) {}

      return nomes;
    }

    async function carregarMunicipiosGoias() {
      if (municipiosCarregados) return;

      const valorAnterior = els.municipio ? els.municipio.value : "";
      let geojson = null;

      try {
        geojson = await carregarGeojsonMunicipios(GOIAS_MUNICIPIOS_IBGE_URL);
      } catch (_) {
        try {
          geojson = await carregarGeojsonMunicipios(GOIAS_MUNICIPIOS_FALLBACK_URL);
        } catch (_) {
          municipiosGoias = [];
          municipiosCarregados = true;
          if (els.municipio) {
            els.municipio.innerHTML = `<option value="">Todos os municípios</option>`;
          }
          return;
        }
      }

      const nameMap = await carregarNomesMunicipiosIbge();
      const features = Array.isArray(geojson.features) ? geojson.features : [];
      municipiosGoias = features
        .filter(f => f && f.geometry)
        .map((feature, idx) => {
          const id = idMunicipioFeature(feature, idx);
          return {
            id,
            nome: nameMap.get(String(id)) || nomeMunicipioFeature(feature) || `Município ${id || idx + 1}`,
            feature
          };
        })
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

      municipiosCarregados = true;
      desenharDivisasMunicipais();

      if (els.municipio) {
        els.municipio.innerHTML =
          `<option value="">Todos os municípios</option>` +
          municipiosGoias.map(m =>
            `<option value="${escapeHtml(m.id)}">${escapeHtml(m.nome)}</option>`
          ).join("");

        if (valorAnterior && municipiosGoias.some(m => m.id === valorAnterior)) {
          els.municipio.value = valorAnterior;
        }
      }
    }

    function desenharDivisasMunicipais() {
      layerMunicipiosDivisas.clearLayers();

      if (!municipiosGoias || !municipiosGoias.length) return;

      L.geoJSON(municipiosGoias.map(m => m.feature), {
        interactive: false,
        style: {
          color: "#52e2ff",
          weight: 1,
          opacity: 0.45,
          fill: false
        }
      }).addTo(layerMunicipiosDivisas);
    }

    function municipioSelecionado() {
      if (!els.municipio || !els.municipio.value) return null;
      return municipiosGoias.find(m => m.id === els.municipio.value) || null;
    }

    function nomeMunicipioSelecionado() {
      const m = municipioSelecionado();
      return m ? m.nome : "";
    }

    function usarEntornoMunicipio() {
      return true;
    }

    function raioEntornoKm() {
      return 10;
    }

    function textoFiltroCidade() {
      const nome = nomeMunicipioSelecionado();
      if (!nome) return "";
      if (!usarEntornoMunicipio()) return nome;
      return `${nome} + entorno de ${raioEntornoKm()} km`;
    }

    function distanciaPontoSegmentoKm(lat, lon, lat1, lon1, lat2, lon2) {
      const lat0 = lat * Math.PI / 180;
      const kmPorGrauLat = 111.32;
      const kmPorGrauLon = Math.max(0.01, 111.32 * Math.cos(lat0));

      const px = lon * kmPorGrauLon;
      const py = lat * kmPorGrauLat;
      const ax = lon1 * kmPorGrauLon;
      const ay = lat1 * kmPorGrauLat;
      const bx = lon2 * kmPorGrauLon;
      const by = lat2 * kmPorGrauLat;

      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;

      if (len2 <= 0) {
        const x = px - ax;
        const y = py - ay;
        return Math.sqrt(x * x + y * y);
      }

      let t = ((px - ax) * dx + (py - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));

      const cx = ax + t * dx;
      const cy = ay + t * dy;
      const x = px - cx;
      const y = py - cy;

      return Math.sqrt(x * x + y * y);
    }

    function distanciaPontoRingKm(lat, lon, ring) {
      if (!Array.isArray(ring) || ring.length < 2) return Infinity;

      let menor = Infinity;

      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i];
        const b = ring[i + 1];

        if (!a || !b) continue;

        const lon1 = Number(a[0]);
        const lat1 = Number(a[1]);
        const lon2 = Number(b[0]);
        const lat2 = Number(b[1]);

        if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) continue;

        menor = Math.min(menor, distanciaPontoSegmentoKm(lat, lon, lat1, lon1, lat2, lon2));
      }

      return menor;
    }

    function distanciaPontoGeometryKm(lat, lon, geometry) {
      if (!geometry) return Infinity;

      let menor = Infinity;

      if (geometry.type === "Polygon") {
        (geometry.coordinates || []).forEach(ring => {
          menor = Math.min(menor, distanciaPontoRingKm(lat, lon, ring));
        });
      } else if (geometry.type === "MultiPolygon") {
        (geometry.coordinates || []).forEach(poly => {
          (poly || []).forEach(ring => {
            menor = Math.min(menor, distanciaPontoRingKm(lat, lon, ring));
          });
        });
      }

      return menor;
    }

    function pontoPertoDoMunicipio(lat, lon, municipio, raioKm) {
      if (!municipio || !municipio.feature || !municipio.feature.geometry) return false;
      return distanciaPontoGeometryKm(lat, lon, municipio.feature.geometry) <= raioKm;
    }

    function pontoDentroDoFiltroMunicipio(lat, lon) {
      const m = municipioSelecionado();
      if (!m) return true;

      if (pointInGeometry([lon, lat], m.feature.geometry)) return true;

      if (usarEntornoMunicipio()) {
        return pontoPertoDoMunicipio(lat, lon, m, raioEntornoKm());
      }

      return false;
    }

    function algumPontoDentroDoFiltroMunicipio(coords) {
      return (coords || []).some(([lat, lon]) =>
        pontoDentroDeGoias(lat, lon) && pontoDentroDoFiltroMunicipio(lat, lon)
      );
    }

    function atualizarDestaqueMunicipioSelecionado() {
      layerMunicipioSelecionado.clearLayers();

      const m = municipioSelecionado();
      if (!m) return;

      const layer = L.geoJSON(m.feature, {
        style: {
          color: "#52e2ff",
          weight: 3,
          fillColor: "#52e2ff",
          fillOpacity: 0.035
        }
      }).addTo(layerMunicipioSelecionado);

      try {
        const bounds = layer.getBounds();
        if (bounds && bounds.isValid && bounds.isValid()) {
          map.fitBounds(bounds, { padding: [24, 24] });
        }
      } catch (_) {}
    }

    function svgFogo(corExterna, corInterna, corCentro, classeExtra = "") {
      const isLegend = String(classeExtra || "").includes("legend-svg");
      const w = isLegend ? 20 : 42;
      const h = isLegend ? 20 : 42;
      const c1 = escapeHtml(corExterna);
      const c2 = escapeHtml(corInterna);
      const c3 = escapeHtml(corCentro);

      return `
        <svg class="fire-icon ${classeExtra}" viewBox="0 0 64 64" width="${w}" height="${h}" aria-hidden="true" style="display:block !important;width:${w}px !important;height:${h}px !important;min-width:${w}px !important;min-height:${h}px !important;max-width:${w}px !important;max-height:${h}px !important;overflow:visible !important;fill:none !important;forced-color-adjust:none;">
          <path d="M34.8 3.8c3.8 10.3-2.4 14.9-5.9 20.4-2.7-5.2-7.2-8.3-7.2-8.3.8 8.5-7.6 13.2-7.6 25.2C14.1 53.3 23.7 61 32 61s18.4-7.4 18.4-20.2c0-15.4-10.9-22.4-15.6-37z" fill="${c1}" style="fill:${c1} !important;"/>
          <path d="M36.1 28.1c2.4 6.5-1.5 9.3-3.7 12.8-1.7-3.3-4.5-5.2-4.5-5.2.5 5.3-4.7 8.2-4.7 15.7 0 7.6 6 12.4 11.2 12.4s11.5-4.6 11.5-12.6c0-9.7-6.9-14-9.8-23.1z" fill="${c2}" style="fill:${c2} !important;"/>
          <path d="M31.5 47.3c-1.8 2.3-3 4.1-3 7 0 3.7 2.8 6 5.8 6 3.1 0 6.3-2.5 6.3-6.6 0-4.8-3.7-7.2-5.8-11.9.3 4.1-2 5.2-3.3 5.5z" fill="${c3}" style="fill:${c3} !important;"/>
        </svg>
      `;
    }

    function criarIconeFogo(tipo, numero = null) {
      const recente = tipo === "recente";
      const svg = recente
        ? svgFogo("#ff4b1f", "#ffd23f", "#fff1a6")
        : svgFogo("#6f6f6f", "#9a9a9a", "#d1d1d1");

      const badge = recente && numero !== null && numero !== undefined
        ? `<span class="focus-number-badge">${escapeHtml(numero)}</span>`
        : "";

      return L.divIcon({
        className: "fire-div-icon",
        html: `<div class="fire-click-target" role="button" aria-label="Abrir opções do foco" tabindex="0" style="background:transparent!important;background-color:transparent!important;border:0!important;box-shadow:none!important;outline:0!important;padding:0!important;margin:0!important;"><span class="fire-marker" style="background:transparent!important;background-color:transparent!important;border:0!important;box-shadow:none!important;">${svg}${badge}</span></div>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        popupAnchor: [0, -18]
      });
    }

    const legendFireHotEl = document.getElementById("legendFireHot");
    const legendFireGrayEl = document.getElementById("legendFireGray");
    if (legendFireHotEl) legendFireHotEl.innerHTML = svgFogo("#ff4b1f", "#ffd23f", "#fff1a6", "legend-svg");
    if (legendFireGrayEl) legendFireGrayEl.innerHTML = svgFogo("#6f6f6f", "#9a9a9a", "#d1d1d1", "legend-svg");

    async function carregarLimiteGoias() {
      if (goiasGeometry) return;
      try {
        const resp = await fetchComTimeout(GOIAS_GEOJSON_URL, { cache: "force-cache", mode: "cors" }, 16000);
        if (!resp.ok) throw new Error("Falha ao carregar limite de Goiás");

        const geojson = await resp.json();
        const feature = geojson.features.find((f) => {
          const p = f.properties || {};
          const name = String(p.name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
          return String(p.sigla || "").toUpperCase() === "GO" || name === "GOIAS" || String(p.codigo_ibg || "") === "52";
        });

        if (!feature) throw new Error("Limite de Goiás não encontrado");

        goiasGeometry = feature.geometry;
        layerLimite.clearLayers();

        const layer = L.geoJSON(feature, {
          style: {
            color: "#ffd166",
            weight: 2,
            fillColor: "#ffd166",
            fillOpacity: 0.035
          }
        }).addTo(layerLimite);

        limitarZoomMinimoGoias(layer.getBounds());

        if (!userLocated || !userInsideGoias) {
          map.fitBounds(layer.getBounds(), { padding: [20, 20] });
          limitarZoomMinimoGoias(layer.getBounds());
        }
      } catch (_) {
        goiasGeometry = null;
        layerLimite.clearLayers();

        L.rectangle(GOIAS_BOUNDS, {
          color: "#ffd166",
          weight: 1,
          fill: false,
          dashArray: "5,6",
          opacity: 0.85
        }).addTo(layerLimite);

        limitarZoomMinimoGoias(GOIAS_BOUNDS);
        if (!userLocated || !userInsideGoias) zoomGoias();
      }
    }

    function gerarUrlsCsv(horas) {
      const urls = [];
      const now = new Date();

      now.setUTCSeconds(0, 0);
      now.setUTCMinutes(Math.floor(now.getUTCMinutes() / 10) * 10);

      // O INPE pode demorar para publicar os arquivos de 10 minutos.
      // Começa 40 minutos para trás para evitar consultar um arquivo que ainda não existe.
      const atrasoPublicacaoMin = 40;
      const inicio = new Date(now.getTime() - atrasoPublicacaoMin * 60 * 1000);
      inicio.setUTCMinutes(Math.floor(inicio.getUTCMinutes() / 10) * 10, 0, 0);

      const quantidade = Math.ceil(horas * 6) + 14;

      for (let i = 0; i <= quantidade; i++) {
        const d = new Date(inicio.getTime() - i * 10 * 60 * 1000);

        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        const hh = String(d.getUTCHours()).padStart(2, "0");
        const mi = String(d.getUTCMinutes()).padStart(2, "0");

        urls.push(`${INPE_BASE}focos_10min_${yyyy}${mm}${dd}_${hh}${mi}.csv`);
      }

      return urls;
    }

    async function carregarCsv(url) {
      const resp = await fetchComTimeout(url, { cache: "no-store", mode: "cors" }, 9000);
      if (!resp.ok) {
        return [];
      }

      const texto = await resp.text();
      return parseCsvFocos(texto, url);
    }

    function parseCsvFocos(texto, url) {
      const linhas = texto.replace(/^\uFEFF/, "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const focos = [];

      for (const linha of linhas) {
        if (/^lat\s*,\s*lon/i.test(linha)) continue;

        const partes = splitCsvLine(linha);
        if (partes.length < 4) continue;

        const lat = Number(String(partes[0]).trim().replace(",", "."));
        const lon = Number(String(partes[1]).trim().replace(",", "."));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        const satelite = String(partes[2] || "").trim();
        const data = String(partes[3] || "").trim();

        focos.push({
          lat,
          lon,
          satelite,
          data,
          timestamp: parseData(data),
          fonte: url
        });
      }

      return focos;
    }

    function parseCsvGenerico(texto) {
      const linhas = texto.replace(/^\uFEFF/, "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (!linhas.length) return [];

      const cabecalho = splitCsvLine(linhas[0]).map(c => String(c || "").trim());
      const registros = [];

      for (let i = 1; i < linhas.length; i++) {
        const partes = splitCsvLine(linhas[i]);
        const obj = {};

        cabecalho.forEach((campo, idx) => {
          obj[campo] = partes[idx] !== undefined ? String(partes[idx]).trim() : "";
        });

        registros.push(obj);
      }

      return registros;
    }

    function nomeCampoNormalizado(nome) {
      return String(nome || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    }

    function valorPorCampos(registro, nomesPossiveis) {
      const mapa = {};
      Object.keys(registro || {}).forEach(k => {
        mapa[nomeCampoNormalizado(k)] = registro[k];
      });

      for (const nome of nomesPossiveis) {
        const v = mapa[nomeCampoNormalizado(nome)];
        if (v !== undefined && String(v).trim() !== "") return String(v).trim();
      }

      return "";
    }

    function coordenadaExtra(registro, tipo) {
      const valor = tipo === "lat"
        ? valorPorCampos(registro, ["lat", "latitude", "latgms"])
        : valorPorCampos(registro, ["lon", "long", "longitude", "longms", "lng"]);

      const n = Number(String(valor).replace(",", "."));
      return Number.isFinite(n) ? n : null;
    }

    function chaveCoordenada(lat, lon, satelite = "") {
      const sat = String(satelite || "").trim().toUpperCase();
      return `${Number(lat).toFixed(4)}|${Number(lon).toFixed(4)}|${sat}`;
    }

    function chaveCoordenadaSemSatelite(lat, lon) {
      return `${Number(lat).toFixed(4)}|${Number(lon).toFixed(4)}`;
    }

    function normalizarExtraBDQ(registro) {
      if (!registro) return null;

      const extra = {
        municipio: valorPorCampos(registro, ["municipio", "municipi", "município"]),
        estado: valorPorCampos(registro, ["estado", "uf"]),
        pais: valorPorCampos(registro, ["pais", "país"]),
        bioma: valorPorCampos(registro, ["bioma"]),
        riscoFogo: valorPorCampos(registro, ["riscofogo", "riscofog", "risco_fogo", "risco de fogo"]),
        precipitacao: valorPorCampos(registro, ["precipitacao", "precipitação", "prec", "chuva"]),
        diasSemChuva: valorPorCampos(registro, ["diasemchuva", "diassch", "dias_sem_chuva", "dias sem chuva"]),
        frp: valorPorCampos(registro, ["frp", "potencia", "potência"]),
        raw: registro
      };

      const temAlgum = Object.keys(extra).some(k => k !== "raw" && String(extra[k] || "").trim() !== "");
      return temAlgum ? extra : null;
    }

    function datasUtcDosFocos(focos) {
      const datas = new Set();
      const agora = new Date();
      const hoje = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
      datas.add(formatarYmdUtc(hoje.getTime()));
      datas.add(formatarYmdUtc(hoje.getTime() - 24 * 60 * 60 * 1000));

      for (const f of focos) {
        if (!f.timestamp) continue;
        datas.add(formatarYmdUtc(f.timestamp));
      }

      return [...datas];
    }

    function formatarYmdUtc(timestamp) {
      const d = new Date(timestamp);
      return String(d.getUTCFullYear()) +
        String(d.getUTCMonth() + 1).padStart(2, "0") +
        String(d.getUTCDate()).padStart(2, "0");
    }

    async function carregarDadosExtrasBDQueimadas(focos) {
      if (!focos || !focos.length) {
        if (els.extrasStatus) els.extrasStatus.textContent = "Sem focos para buscar detalhes extras.";
        return;
      }

      if (els.extrasStatus) els.extrasStatus.textContent = "Buscando detalhes extras do BDQueimadas...";

      const datas = datasUtcDosFocos(focos);
      const urls = datas.map(d => `${INPE_DIARIO_BASE}focos_diario_br_${d}.csv`);
      const registros = [];

      await Promise.all(urls.map(async (url) => {
        try {
          const resp = await fetchComTimeout(url, { cache: "no-store", mode: "cors" }, 9000);
          if (!resp.ok) return;

          const texto = await resp.text();
          registros.push(...parseCsvGenerico(texto));
        } catch (_) {
          // Mantém o site funcionando mesmo se o CSV diário não estiver disponível.
        }
      }));

      if (!registros.length) {
        if (els.extrasStatus) els.extrasStatus.textContent = "Detalhes extras do BDQueimadas não disponíveis agora.";
        return;
      }

      const porCoordSat = new Map();
      const porCoord = new Map();

      for (const r of registros) {
        const lat = coordenadaExtra(r, "lat");
        const lon = coordenadaExtra(r, "lon");
        if (lat === null || lon === null) continue;

        const sat = valorPorCampos(r, ["satelite", "satélite", "satellite"]);
        const keySat = chaveCoordenada(lat, lon, sat);
        const keyCoord = chaveCoordenadaSemSatelite(lat, lon);

        if (sat && !porCoordSat.has(keySat)) porCoordSat.set(keySat, r);
        if (!porCoord.has(keyCoord)) porCoord.set(keyCoord, r);
      }

      let enriquecidos = 0;

      for (const f of focos) {
        const r = porCoordSat.get(chaveCoordenada(f.lat, f.lon, f.satelite)) ||
          porCoord.get(chaveCoordenadaSemSatelite(f.lat, f.lon));

        const extra = normalizarExtraBDQ(r);
        if (extra) {
          f.extraBDQ = extra;
          enriquecidos++;
        }
      }

      if (els.extrasStatus) {
        els.extrasStatus.textContent = enriquecidos
          ? `Detalhes extras aplicados em ${enriquecidos} foco(s).`
          : "CSV diário encontrado, mas sem detalhe extra correspondente aos focos atuais.";
      }
    }


    function gerarUrlsCsvDiarioFallback(horas) {
      const urls = [];
      const dias = new Set();
      const agora = Date.now();
      const diasNecessarios = Math.max(2, Math.ceil(Number(horas || 24) / 24) + 1);

      for (let i = 0; i < diasNecessarios; i++) {
        dias.add(formatarYmdUtc(agora - i * 24 * 60 * 60 * 1000));
      }

      return [...dias].map(d => `${INPE_DIARIO_BASE}focos_diario_br_${d}.csv`);
    }

    function parseFocosDiarioFallback(texto, url) {
      const registros = parseCsvGenerico(texto);
      const focos = [];

      for (const r of registros) {
        const lat = coordenadaExtra(r, "lat");
        const lon = coordenadaExtra(r, "lon");
        if (lat === null || lon === null) continue;

        const satelite = valorPorCampos(r, [
          "satelite", "satélite", "satellite", "sensor", "satelite referência", "satelitereferencia"
        ]) || "INPE";

        const data = valorPorCampos(r, [
          "datahora", "data_hora", "datahora_gmt", "data_hora_gmt",
          "data", "datautc", "data_utc", "datetime", "timestamp",
          "visto_pelo_satelite", "visto pelo satelite", "visto pelo satélite"
        ]);

        const foco = {
          lat,
          lon,
          satelite,
          data,
          timestamp: parseData(data),
          fonte: url
        };

        const extra = normalizarExtraBDQ(r);
        if (extra) foco.extraBDQ = extra;

        focos.push(foco);
      }

      return focos;
    }

    async function carregarFocosDiarioFallback(horas) {
      const urls = gerarUrlsCsvDiarioFallback(horas);
      const focos = [];
      let csvsLidos = 0;

      for (const url of urls) {
        try {
          const resp = await fetchComTimeout(url, { cache: "no-store", mode: "cors" }, 9000);
          if (!resp.ok) continue;

          const texto = await resp.text();
          const dados = parseFocosDiarioFallback(texto, url);

          if (dados.length > 0) {
            csvsLidos++;
            focos.push(...dados);
          }
        } catch (_) {}
      }

      return { focos, csvsLidos };
    }


    function splitCsvLine(line) {
      const result = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = line[i + 1];

        if (ch === '"' && inQuotes && next === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          result.push(current);
          current = "";
        } else {
          current += ch;
        }
      }

      result.push(current);
      return result;
    }

    function parseData(data) {
      const s = String(data || "").trim();
      if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) {
        return new Date(s.replace(" ", "T") + "Z").getTime();
      }
      const t = new Date(s).getTime();
      return Number.isFinite(t) ? t : 0;
    }

    function pointInGeometry(point, geometry) {
      if (!geometry) return false;
      if (geometry.type === "Polygon") return pointInPolygon(point, geometry.coordinates);
      if (geometry.type === "MultiPolygon") return geometry.coordinates.some(poly => pointInPolygon(point, poly));
      return false;
    }

    function pointInPolygon(point, polygonCoords) {
      if (!polygonCoords || !polygonCoords.length) return false;
      if (!pointInRing(point, polygonCoords[0])) return false;

      for (let i = 1; i < polygonCoords.length; i++) {
        if (pointInRing(point, polygonCoords[i])) return false;
      }
      return true;
    }

    function pointInRing(point, ring) {
      const x = point[0], y = point[1];
      let inside = false;

      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = Number(ring[i][0]), yi = Number(ring[i][1]);
        const xj = Number(ring[j][0]), yj = Number(ring[j][1]);

        const intersect = ((yi > y) !== (yj > y)) &&
          (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 0.0000001) + xi);

        if (intersect) inside = !inside;
      }

      return inside;
    }

    function pontoDentroDeGoias(lat, lon) {
      if (goiasGeometry) return pointInGeometry([lon, lat], goiasGeometry);
      return lat >= GOIAS_BOUNDS[0][0] &&
             lat <= GOIAS_BOUNDS[1][0] &&
             lon >= GOIAS_BOUNDS[0][1] &&
             lon <= GOIAS_BOUNDS[1][1];
    }

    function deduplicar(focos) {
      const vistos = new Set();
      const out = [];

      for (const f of focos) {
        const key = `${f.lat.toFixed(5)}|${f.lon.toFixed(5)}|${f.satelite}|${f.data}`;
        if (vistos.has(key)) continue;
        vistos.add(key);
        f.id = key;
        out.push(f);
      }

      return out;
    }

    function classificarFoco(foco, referenciaTimestamp, periodoHoras) {
      const periodoMin = Math.max(60, Number(periodoHoras || 24) * 60);
      const idadeMin = foco.timestamp ? Math.max(0, (referenciaTimestamp - foco.timestamp) / 60000) : periodoMin;
      const limiteRecente = periodoMin * 0.35;

      // Classificação visual baseada SOMENTE no horário recebido.
      // Sem área visual/área, porque o CSV não envia raio nem área real queimada.
      if (idadeMin <= limiteRecente) {
        return {
          tipo: "recente",
          label: "Foco recente",
          circulo: false,
          mostrarFogo: true,
          fogoTipo: "recente",
          idadeMin: Math.round(idadeMin)
        };
      }

      return {
        tipo: "anterior",
        label: "Foco anterior",
        circulo: false,
        mostrarFogo: true,
        fogoTipo: "anterior",
        idadeMin: Math.round(idadeMin)
      };
    }

    function formatarDataLocal(timestamp) {
      if (!timestamp) return "não informada";
      return new Date(timestamp).toLocaleString("pt-BR");
    }

    function formatarTempoAteAgora(timestamp) {
      if (!timestamp) return "tempo não informado";

      const diffMin = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
      const horas = Math.floor(diffMin / 60);
      const minutos = diffMin % 60;

      if (horas <= 0) return `há ${minutos} min`;
      if (minutos <= 0) return `há ${horas}h`;
      return `há ${horas}h ${minutos}min`;
    }

    function classificarIntensidadeFrp(frpValor) {
      const frp = Number(String(frpValor || "").replace(",", "."));
      if (!Number.isFinite(frp) || frp <= 0) return "";

      if (frp <= INTENSIDADE_FRP_BAIXA_MAX) return "baixa";
      if (frp <= INTENSIDADE_FRP_MEDIA_MAX) return "média";
      return "alta";
    }

    function linhasExtrasBDQ(extra, municipioFallback = "") {
      const linhas = [];
      const municipio = extra && extra.municipio ? extra.municipio : municipioFallback;
      const intensidade = extra && extra.frp ? classificarIntensidadeFrp(extra.frp) : "";

      if (municipio) linhas.push(`Município: ${escapeHtml(municipio)}`);
      if (intensidade) linhas.push(`Intensidade: ${escapeHtml(intensidade)}`);

      return linhas.length ? `<br>${linhas.join("<br>")}` : "";
    }

    function popupFoco(foco, info) {
      const alvoId = registrarAlvoEstradas([[foco.lat, foco.lon]], `foco ${foco.lat.toFixed(5)}, ${foco.lon.toFixed(5)}`);
      const linhaNumero = info && info.tipo === "recente" && info.numeroMapa
        ? `<br>Número do foco recente: ${escapeHtml(info.numeroMapa)}`
        : "";

      return `
        <strong>${escapeHtml(info.label)}</strong>${linhaNumero}<br>
        Latitude/Longitude: ${foco.lat.toFixed(6)}, ${foco.lon.toFixed(6)}<br>
        Satélite: ${escapeHtml(foco.satelite || "não informado")}<br>
        Visto pelo satélite: ${escapeHtml(formatarDataLocal(foco.timestamp))}<br>
        Tempo desde a detecção: ${escapeHtml(formatarTempoAteAgora(foco.timestamp))}${linhasExtrasBDQ(foco.extraBDQ, foco.municipioFiltro)}
        ${botoesAcaoMapa(foco.lat, foco.lon, alvoId, `${info.label} ${foco.dataLocal || ""}`)}
      `;
    }

    function abrirPainelFocoOpcoes(htmlConteudo, origem = "") {
      if (!els.painelFocoOpcoes || !els.painelFocoConteudo) return false;

      els.painelFocoConteudo.innerHTML = htmlConteudo;
      els.painelFocoOpcoes.classList.remove("hidden-ui");
      atualizarBotoesPainelFoco();

      registrarLogPopupFoco("painel proprio foco exibido", {
        origem,
        painelVisivel: !els.painelFocoOpcoes.classList.contains("hidden-ui"),
        largura: els.painelFocoOpcoes.getBoundingClientRect().width,
        altura: els.painelFocoOpcoes.getBoundingClientRect().height
      });

      return true;
    }

    function fecharPainelFocoOpcoes() {
      if (els.painelFocoOpcoes) {
        els.painelFocoOpcoes.classList.add("hidden-ui");
      }
    }

    function atualizarPainelDados(focos) {
    }

    function desenharFocos(focos) {
      fecharPainelFocoOpcoes();
      layerFocos.clearLayers();
      marcadorPorId.clear();
      focosClicaveisNoMapa = [];

      const periodoHoras = Number(els.periodo.value || 24);
      const timestampsValidos = focos.map(f => f.timestamp).filter(t => Number.isFinite(t) && t > 0);
      const referenciaTimestamp = timestampsValidos.length ? Math.max(...timestampsValidos) : Date.now();

      let totalRecente = 0;
      let totalAnterior = 0;

      // Primeiro classifica todos os focos da área selecionada.
      for (const foco of focos) {
        const info = classificarFoco(foco, referenciaTimestamp, periodoHoras);
        foco.infoVisual = info;
        foco.dataLocal = formatarDataLocal(foco.timestamp);
        foco.tempoAtual = formatarTempoAteAgora(foco.timestamp);

        if (info.tipo === "recente") totalRecente++;
        if (info.tipo === "anterior") totalAnterior++;
      }

      // Enumera somente focos recentes por data/horário de detecção.
      // Se dois ou mais focos têm exatamente o mesmo horário, recebem o mesmo número.
      const horariosRecentes = [...new Set(
        focos
          .filter(f => f.infoVisual && f.infoVisual.tipo === "recente" && Number.isFinite(f.timestamp))
          .map(f => Number(f.timestamp))
      )].sort((a, b) => b - a);

      const numeroPorHorario = new Map();
      horariosRecentes.forEach((ts, idx) => numeroPorHorario.set(ts, idx + 1));

      for (const foco of focos) {
        const info = foco.infoVisual || classificarFoco(foco, referenciaTimestamp, periodoHoras);
        if (info.tipo === "recente" && Number.isFinite(foco.timestamp)) {
          info.numeroMapa = numeroPorHorario.get(Number(foco.timestamp)) || null;
        } else {
          info.numeroMapa = null;
        }

        const popupHtml = popupFoco(foco, info);

        if (info.mostrarFogo) {
          const marker = L.marker([foco.lat, foco.lon], {
            icon: criarIconeFogo(info.fogoTipo, info.numeroMapa),
            pane: "paneFocos",
            interactive: true,
            riseOnHover: true,
            zIndexOffset: 5000
          }).addTo(layerFocos);

          marker.bindPopup(popupHtml, { maxWidth: 320, autoPan: true, autoPanPadding: [30, 80] });

          const abrirPopupDoFoco = (origem, ev = null) => {
            try {
              if (ev && ev.originalEvent) {
                ev.originalEvent.preventDefault();
                ev.originalEvent.stopPropagation();
              } else if (ev) {
                ev.preventDefault && ev.preventDefault();
                ev.stopPropagation && ev.stopPropagation();
              }
            } catch (_) {}

            registrarLogPopupFoco("clique foco recebido", {
              origem,
              lat: foco.lat,
              lon: foco.lon,
              label: info.label
            });

            const abriuPainel = abrirPainelFocoOpcoes(popupHtml, origem);
            if (abriuPainel) {
              try { map.closePopup(); } catch (_) {}
              return;
            }

            // Fallback: se o painel próprio não puder abrir por algum motivo, usa o popup nativo do Leaflet.
            try {
              marker.openPopup();
              setTimeout(() => {
                registrarLogPopupFoco("apos marker.openPopup fallback", {
                  origem,
                  popupAberto: marker.isPopupOpen ? marker.isPopupOpen() : null
                });
              }, 80);
            } catch (err) {
              registrarLogPopupFoco("erro marker.openPopup fallback", {
                origem,
                erro: err && err.message ? err.message : String(err)
              });
            }
          };

          marker.on("click", (ev) => abrirPopupDoFoco("leaflet-marker-click", ev));
          marker.on("touchstart", (ev) => abrirPopupDoFoco("leaflet-marker-touchstart", ev));
          marker.on("popupopen", () => registrarLogPopupFoco("popupopen foco fallback", {
            lat: foco.lat,
            lon: foco.lon,
            label: info.label
          }));

          const conectarCliqueDireto = () => {
            const el = marker.getElement();
            if (!el || el.dataset.fireClickReady === "1") return;
            el.dataset.fireClickReady = "1";
            el.style.pointerEvents = "auto";

            const alvoClique = el.querySelector(".fire-click-target") || el;
            alvoClique.addEventListener("click", (domEv) => abrirPopupDoFoco("dom-click", domEv));
            alvoClique.addEventListener("touchstart", (domEv) => abrirPopupDoFoco("dom-touchstart", domEv), { passive: false });
          };

          conectarCliqueDireto();
          marker.on("add", conectarCliqueDireto);

          focosClicaveisNoMapa.push({
            lat: Number(foco.lat),
            lon: Number(foco.lon),
            marker,
            label: info.label,
            id: foco.id,
            html: popupHtml
          });

          marcadorPorId.set(foco.id, marker);
        }
      }

      els.totalFocos.textContent = String(focos.length);
      els.totalRecentes.textContent = String(totalRecente);
      els.totalAnteriores.textContent = String(totalAnterior);

      registrarLogPopupFoco("focos desenhados e clicaveis", {
        totalFocos: focos.length,
        totalClicaveis: focosClicaveisNoMapa.length,
        fireButtons: document.querySelectorAll(".fire-click-target").length
      });

      atualizarPainelDados(focos);
      renderizarLista();
}

    function renderizarLista() {
    }

    function textoDeNo(node, tagName) {
      const el = node.getElementsByTagName(tagName)[0];
      return el ? String(el.textContent || "").trim() : "";
    }

    function textoHtmlParaTextoSeguro(htmlTexto) {
      const tmp = document.createElement("div");
      tmp.innerHTML = String(htmlTexto || "");
      return tmp.textContent || tmp.innerText || "";
    }


    function limparTextoEvento(valor) {
      return String(valor || "")
        .replace(/\s+/g, " ")
        .replace(/^[:\-–—\s]+|[:\-–—\s]+$/g, "")
        .trim();
    }

    function adicionarDadoEvento(dados, chave, valor) {
      const k = limparTextoEvento(chave);
      const v = limparTextoEvento(valor);
      if (!k || !v) return;

      const ignorar = ["", " ", "undefined", "null"];
      if (ignorar.includes(k.toLowerCase()) || ignorar.includes(v.toLowerCase())) return;

      if (!dados[k]) {
        dados[k] = v;
        return;
      }

      let i = 2;
      while (dados[`${k} ${i}`]) i++;
      dados[`${k} ${i}`] = v;
    }

    function extrairDadosDescricaoEvento(htmlDescricao) {
      const dados = {};
      const html = String(htmlDescricao || "").trim();
      if (!html) return dados;

      try {
        const doc = new DOMParser().parseFromString(html, "text/html");

        doc.querySelectorAll("tr").forEach((tr) => {
          const cells = [...tr.querySelectorAll("th,td")].map(td => limparTextoEvento(td.textContent));
          if (cells.length >= 2) adicionarDadoEvento(dados, cells[0], cells.slice(1).join(" "));
        });

        doc.querySelectorAll("li").forEach((li) => {
          const texto = limparTextoEvento(li.textContent);
          const m = texto.match(/^([^:]{2,80})[:：]\s*(.+)$/);
          if (m) adicionarDadoEvento(dados, m[1], m[2]);
        });

        doc.querySelectorAll("dt").forEach((dt) => {
          const dd = dt.nextElementSibling && dt.nextElementSibling.tagName && dt.nextElementSibling.tagName.toLowerCase() === "dd"
            ? dt.nextElementSibling
            : null;
          if (dd) adicionarDadoEvento(dados, dt.textContent, dd.textContent);
        });
      } catch (_) {}

      const texto = textoHtmlParaTextoSeguro(html).replace(/\s+/g, " ").trim();

      texto.split(/\s{2,}|;\s*/).forEach((parte) => {
        const m = parte.match(/^([^:]{2,80})[:：]\s*(.+)$/);
        if (m) adicionarDadoEvento(dados, m[1], m[2]);
      });

      return dados;
    }


    function extrairDadosKmlPlacemark(pm) {
      const dados = {};
      const dataNodes = [...pm.getElementsByTagName("Data")];

      dataNodes.forEach((d) => {
        const nome = d.getAttribute("name") || "";
        const valor = textoDeNo(d, "value");
        adicionarDadoEvento(dados, nome, valor);
      });

      const simpleNodes = [...pm.getElementsByTagName("SimpleData")];
      simpleNodes.forEach((d) => {
        const nome = d.getAttribute("name") || "";
        const valor = String(d.textContent || "").trim();
        adicionarDadoEvento(dados, nome, valor);
      });

      const dadosDescricao = extrairDadosDescricaoEvento(textoDeNo(pm, "description"));
      Object.entries(dadosDescricao).forEach(([k, v]) => {
        if (!dados[k]) dados[k] = v;
      });

      return dados;
    }

    function montarLinhasDadosKml(dados) {
      const chaves = Object.keys(dados || {}).filter(k => String(dados[k] || "").trim() !== "");
      if (!chaves.length) {
        return `<div class="evento-popup-vazio">O KML não trouxe campos extras estruturados para este evento.</div>`;
      }

      const preferidas = [
        "area", "area_km2", "area_km", "area_ha", "perimetro", "duracao", "duração",
        "uso_solo", "uso do solo", "classe", "status", "municipio", "município",
        "estado", "uf", "bioma", "satelite", "satélite", "data", "inicio", "início",
        "fim", "frente", "ultimo", "último", "foco", "risco"
      ];

      const escolhidas = [];
      const usadas = new Set();

      for (const pref of preferidas) {
        const prefNorm = nomeCampoNormalizado(pref);
        const achadas = chaves.filter(k => nomeCampoNormalizado(k).includes(prefNorm));
        achadas.forEach((achada) => {
          if (!usadas.has(achada)) {
            escolhidas.push(achada);
            usadas.add(achada);
          }
        });
      }

      for (const k of chaves) {
        if (!usadas.has(k)) {
          escolhidas.push(k);
          usadas.add(k);
        }
      }

      const linhas = escolhidas.slice(0, 32).map(k =>
        `<div class="evento-popup-linha"><span>${escapeHtml(k)}</span><strong>${escapeHtml(String(dados[k]))}</strong></div>`
      ).join("");

      const resto = escolhidas.length > 32
        ? `<div class="evento-popup-vazio">+ ${escolhidas.length - 32} campo(s) oculto(s) para manter a janela legível.</div>`
        : "";

      return `<div class="evento-popup-tabela">${linhas}${resto}</div>`;
    }

    function parseKmlCoordinates(texto) {
      return String(texto || "").trim().split(/\s+/).map((token) => {
        const partes = token.split(",");
        const lon = Number(partes[0]);
        const lat = Number(partes[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return [lat, lon];
      }).filter(Boolean);
    }

    function algumPontoEmGoias(coords) {
      const m = municipioSelecionado();
      if (m) return algumPontoDentroDoFiltroMunicipio(coords);
      return (coords || []).some(([lat, lon]) => pontoDentroDeGoias(lat, lon));
    }

    function normalizarTextoEvento(valor) {
      return String(valor || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    }

    function parseDataHoraEvento(valor) {
      const texto = String(valor || "").trim();
      if (!texto) return 0;

      const matches = [
        ...texto.matchAll(/\b\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?\b/g),
        ...texto.matchAll(/\b\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?\b/g),
        ...texto.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g),
        ...texto.matchAll(/\b\d{2}\/\d{2}\/\d{4}\b/g)
      ].map(m => m[0]);

      for (const c of matches) {
        let t = 0;

        if (/^\d{2}\/\d{2}\/\d{4}/.test(c)) {
          const p = c.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
          if (p) {
            // Sem fuso explícito, considera horário de Goiás/Brasil.
            t = new Date(`${p[3]}-${p[2]}-${p[1]}T${p[4] || "00"}:${p[5] || "00"}:${p[6] || "00"}-03:00`).getTime();
          }
        } else {
          const temHora = /[T\s]\d{2}:\d{2}/.test(c);
          const temFuso = /(Z|[+-]\d{2}:?\d{2})$/.test(c);
          if (temHora && temFuso) t = new Date(c.replace(" ", "T")).getTime();
          else if (temHora) t = new Date(c.replace(" ", "T") + "-03:00").getTime();
          else t = new Date(c + "T00:00:00-03:00").getTime();
        }

        if (Number.isFinite(t) && t > 0) return t;
      }

      return 0;
    }

    function textoDescricaoPlacemark(pm) {
      return textoHtmlParaTextoSeguro(textoDeNo(pm, "description")).replace(/\s+/g, " ").trim();
    }

    function ultimoFocoTimestampEvento(pm, dados) {
      const candidatos = [];

      Object.entries(dados || {}).forEach(([chave, valor]) => {
        const k = normalizarTextoEvento(chave);
        const v = String(valor || "").trim();
        if (!v) return;

        if (
          (k.includes("ultimo") && k.includes("foco")) ||
          (k.includes("ult") && k.includes("foco")) ||
          k.includes("ultimofoco") ||
          k.includes("datahoraultimofoco") ||
          k.includes("dtultimofoco") ||
          k.includes("lastfocus") ||
          k.includes("lastfire")
        ) {
          candidatos.push(v);
        }
      });

      const textoCompleto = `${textoDeNo(pm, "name")} ${textoDescricaoPlacemark(pm)}`;

      const rx = /(último\s+foco|ultimo\s+foco|último_foco|ultimo_foco|ult\.?\s*foco|data\s*hora\s*último\s*foco|data\s*hora\s*ultimo\s*foco|data_hora_ultimo_foco|data\s*do\s*último\s*foco|data\s*do\s*ultimo\s*foco)[^0-9]{0,180}((?:\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?)/gi;
      let m;
      while ((m = rx.exec(textoCompleto)) !== null) {
        candidatos.push(m[2]);
      }

      for (const c of candidatos) {
        const t = parseDataHoraEvento(c);
        if (t) return t;
      }

      return 0;
    }

    function eventoDentroDoPeriodo(pm, dados) {
      const t = ultimoFocoTimestampEvento(pm, dados);

      // Regra de segurança: se não achar "último foco", mostra o evento.
      // Isso impede que o filtro esconda todos os eventos por causa de mudança no KML.
      if (!t) return true;

      const horas = Number(els.periodo ? els.periodo.value : 24);
      const limite = Date.now() - horas * 60 * 60 * 1000;
      return t >= limite;
    }

    function coordsPlacemarkEvento(pm) {
      const coords = [];

      [...pm.getElementsByTagName("Point")].forEach((p) => {
        coords.push(...parseKmlCoordinates(textoDeNo(p, "coordinates")));
      });

      [...pm.getElementsByTagName("LineString")].forEach((l) => {
        coords.push(...parseKmlCoordinates(textoDeNo(l, "coordinates")));
      });

      [...pm.getElementsByTagName("Polygon")].forEach((poly) => {
        let c = [];
        const outer = poly.getElementsByTagName("outerBoundaryIs")[0];
        if (outer) c = parseKmlCoordinates(textoDeNo(outer, "coordinates"));
        if (!c.length) c = parseKmlCoordinates(textoDeNo(poly, "coordinates"));
        coords.push(...c);
      });

      return coords;
    }

    function popupEvento(tipoLabel, pm, dados, coordsEvento = []) {
      const nome = textoDeNo(pm, "name") || tipoLabel;
      const descricaoRaw = textoDeNo(pm, "description");
      const descricao = textoHtmlParaTextoSeguro(descricaoRaw).replace(/\s+/g, " ").trim();
      const ultimoFoco = ultimoFocoTimestampEvento(pm, dados);

      const centro = centroDosPontos(coordsEvento);
      const alvoId = registrarAlvoEstradas(coordsEvento, nome || tipoLabel);
      const acoes = centro ? botoesAcaoMapa(centro[0], centro[1], alvoId, nome || tipoLabel) : "";

      const linhaUltimoFoco = ultimoFoco
        ? `<div class="evento-popup-linha destaque"><span>Último foco usado no filtro</span><strong>${escapeHtml(formatarDataLocal(ultimoFoco))}</strong></div>`
        : "";

      const coordsResumo = coordsEvento && coordsEvento.length
        ? `<div class="evento-popup-linha"><span>Coordenadas da geometria</span><strong>${coordsEvento.length}</strong></div>`
        : "";

      const descricaoBloco = descricao
        ? `<div class="evento-popup-descricao"><strong>Descrição original do KML</strong><br>${escapeHtml(descricao.slice(0, 2200))}${descricao.length > 2200 ? "..." : ""}</div>`
        : "";

      return `<div class="evento-popup-completo">` +
        `<div class="evento-popup-titulo">${escapeHtml(tipoLabel)}</div>` +
        `<div class="evento-popup-subtitulo">${escapeHtml(nome)}</div>` +
        `<div class="evento-popup-tabela">` +
        linhasAtualizacaoEvento(tipoLabel.includes("ativo") ? "ativo" : "observacao", false) +
        linhaUltimoFoco +
        coordsResumo +
        `</div>` +
        `<div class="evento-popup-secao">Dados do evento</div>` +
        montarLinhasDadosKml(dados) +
        descricaoBloco +
        acoes +
        `</div>`;
    }

    function styleEvento(tipo) {
      if (tipo === "ativo") {
        return {
          color: "#ff8a00",
          weight: 3,
          opacity: 0.9,
          fillColor: "#ff8a00",
          fillOpacity: 0.18,
          pane: "paneEventos"
        };
      }

      return {
        color: "#b9b9b9",
        weight: 3,
        opacity: 0.9,
        fillColor: "#b9b9b9",
        fillOpacity: 0.14,
        pane: "paneEventos"
      };
    }

    function desenharPlacemarkKml(pm, tipo, layerGroup) {
      const tipoLabel = tipo === "ativo" ? "Evento de fogo ativo" : "Evento em observação";
      const dados = extrairDadosKmlPlacemark(pm);

      if (eventosDebugExecucao) eventosDebugExecucao.placemarks++;

      const ultimoFocoTs = ultimoFocoTimestampEvento(pm, dados);
      if (eventosDebugExecucao) {
        if (ultimoFocoTs) eventosDebugExecucao.comUltimoFoco++;
        else eventosDebugExecucao.semUltimoFoco++;
      }

      if (ultimoFocoTs) {
        const horas = Number(els.periodo ? els.periodo.value : 24);
        const limite = Date.now() - horas * 60 * 60 * 1000;
        if (ultimoFocoTs < limite) {
          if (eventosDebugExecucao) eventosDebugExecucao.filtradasPeriodo++;
          return 0;
        }
      }

      const coordsEventoAlvo = coordsPlacemarkEvento(pm);
      const popup = popupEvento(tipoLabel, pm, dados, coordsEventoAlvo);
      const style = styleEvento(tipo);
      let desenhou = 0;
      let temGeometria = false;
      let foraArea = 0;

      const pontos = [...pm.getElementsByTagName("Point")];
      pontos.forEach((p) => {
        const coords = parseKmlCoordinates(textoDeNo(p, "coordinates"));
        if (!coords.length) return;
        temGeometria = true;
        if (!algumPontoEmGoias(coords)) {
          foraArea++;
          return;
        }

        coords.forEach(([lat, lon]) => {
          const ponto = L.circleMarker([lat, lon], {
            radius: 12,
            color: "#ffffff",
            weight: 3,
            fillColor: style.fillColor,
            fillOpacity: 0.95,
            pane: "paneEventos",
            interactive: true,
            bubblingMouseEvents: false
          });

          configurarCamadaEventoClicavel(ponto, popup).addTo(layerGroup);
          marcadorDestaqueEvento(lat, lon, tipo, popup);
          registrarEventoNoMapa([lat, lon], tipo);
          registrarEventoSnapshot(tipo, "point", [[lat, lon]], tipoLabel);
          desenhou++;
        });
      });

      const linhas = [...pm.getElementsByTagName("LineString")];
      linhas.forEach((l) => {
        const coords = parseKmlCoordinates(textoDeNo(l, "coordinates"));
        if (!coords.length) return;
        temGeometria = true;
        if (!algumPontoEmGoias(coords)) {
          foraArea++;
          return;
        }

        const linhaVisual = L.polyline(coords, Object.assign({}, style, {
          weight: Math.max(5, style.weight || 3),
          opacity: 1,
          interactive: true,
          bubblingMouseEvents: false
        }));

        const linhaClique = L.polyline(coords, {
          color: "#ffffff",
          weight: 24,
          opacity: 0.01,
          pane: "paneEventos",
          interactive: true,
          bubblingMouseEvents: false
        });

        configurarCamadaEventoClicavel(linhaVisual, popup).addTo(layerGroup);
        configurarCamadaEventoClicavel(linhaClique, popup).addTo(layerGroup);

        registrarEventoNoMapa(coords, tipo);
        registrarEventoSnapshot(tipo, "line", coords, tipoLabel);
        const meio = coords[Math.floor(coords.length / 2)];
        if (meio) marcadorDestaqueEvento(meio[0], meio[1], tipo, popup);
        desenhou++;
      });

      const poligonos = [...pm.getElementsByTagName("Polygon")];
      poligonos.forEach((poly) => {
        let coords = [];
        const outer = poly.getElementsByTagName("outerBoundaryIs")[0];
        if (outer) coords = parseKmlCoordinates(textoDeNo(outer, "coordinates"));
        if (!coords.length) coords = parseKmlCoordinates(textoDeNo(poly, "coordinates"));
        if (!coords.length) return;
        temGeometria = true;
        if (!algumPontoEmGoias(coords)) {
          foraArea++;
          return;
        }

        const polygon = L.polygon(coords, Object.assign({}, style, {
          weight: Math.max(4, style.weight || 2),
          fillOpacity: Math.max(0.24, style.fillOpacity || 0.18),
          interactive: true,
          bubblingMouseEvents: false
        }));

        configurarCamadaEventoClicavel(polygon, popup).addTo(layerGroup);
        registrarEventoNoMapa(coords, tipo);
        registrarEventoSnapshot(tipo, "polygon", coords, tipoLabel);
        const centro = centroDosPontos(coords) || coords[Math.floor(coords.length / 2)];
        if (centro) marcadorDestaqueEvento(centro[0], centro[1], tipo, popup);
        desenhou++;
      });

      if (eventosDebugExecucao) {
        eventosDebugExecucao.desenhadas += desenhou;
        if (!temGeometria) eventosDebugExecucao.semGeometria++;
        if (foraArea > 0 && desenhou === 0) eventosDebugExecucao.foraArea++;
      }

      return desenhou;
    }

    async function carregarEventosKml(tipo) {
      await carregarLimiteGoias();
      await carregarMunicipiosGoias();

      const config = tipo === "ativo"
        ? {
            url: INPE_EVENTOS_ATIVOS_KML,
            layer: layerEventosAtivos,
            cacheKey: "ativos",
            label: "Eventos ativos"
          }
        : {
            url: INPE_EVENTOS_OBSERVACAO_KML,
            layer: layerEventosObservacao,
            cacheKey: "observacao",
            label: "Eventos em observação"
          };

      const eventosOfflineAntes = {
        ativo: eventosOfflineAtuais.ativo.slice(),
        observacao: eventosOfflineAtuais.observacao.slice()
      };
      if (els.eventosStatus) els.eventosStatus.textContent = `Carregando ${config.label.toLowerCase()} da área selecionada...`;
      iniciarDebugEventos(tipo, config.label, Number(els.periodo ? els.periodo.value : 24));

      try {
        let texto = eventosCache[config.cacheKey];

        if (!texto) {
          logEventoDebug(`Baixando KML ${config.label}`, { url: config.url });
          const resp = await fetchComTimeout(config.url, { cache: "no-store", mode: "cors" }, 30000);
          logEventoDebug(`Resposta HTTP ${config.label}`, { status: resp.status, ok: resp.ok });
          if (!resp.ok) throw new Error("HTTP " + resp.status);
          texto = await resp.text();
          eventosCache[config.cacheKey] = texto;
          eventosAtualizacaoMeta[tipo] = {
            baixadoEm: Date.now(),
            lastModified: resp.headers ? (resp.headers.get("last-modified") || resp.headers.get("Last-Modified") || "") : "",
            offline: false,
            erroEm: 0,
            erro: ""
          };
          logEventoDebug(`KML baixado ${config.label}`, { caracteres: texto.length, lastModified: eventosAtualizacaoMeta[tipo].lastModified || null });
        } else {
          eventosAtualizacaoMeta[tipo] = Object.assign({ baixadoEm: Date.now(), lastModified: "", erroEm: 0, erro: "" }, eventosAtualizacaoMeta[tipo] || {}, { offline: false });
          logEventoDebug(`Usando KML em cache ${config.label}`, { caracteres: texto.length });
        }

        const doc = new DOMParser().parseFromString(texto, "application/xml");
        const parserError = doc.getElementsByTagName("parsererror")[0];
        if (parserError) throw new Error("Erro ao interpretar XML/KML");

        const placemarks = [...doc.getElementsByTagName("Placemark")];
        logEventoDebug(`Placemarks encontrados ${config.label}`, { quantidade: placemarks.length });

        // Só apaga a camada antiga depois que o KML novo foi baixado e interpretado.
        // Assim, uma demora/falha no INPE não faz os eventos sumirem do mapa durante a atualização.
        config.layer.clearLayers();
        eventosOfflineAtuais[tipo] = [];
        atualizarContadorEvento(tipo, 0);

        let total = 0;

        placemarks.forEach((pm) => {
          total += desenharPlacemarkKml(pm, tipo, config.layer);
        });

        if (!map.hasLayer(config.layer)) config.layer.addTo(map);

        finalizarDebugEventos(placemarks.length);
        atualizarContadorEvento(tipo, total);

        return total;
      } catch (err) {
        atualizarContadorEvento(tipo, 0);

        if (eventosDebugExecucao) {
          eventosDebugExecucao.erros++;
          logEventoDebug(`Erro ${config.label}`, { mensagem: err && err.message ? err.message : String(err) });
          finalizarDebugEventos(0);
        }

        eventosOfflineAtuais[tipo] = eventosOfflineAntes[tipo] || [];
        eventosAtualizacaoMeta[tipo] = Object.assign({}, eventosAtualizacaoMeta[tipo] || {}, {
          erroEm: Date.now(),
          erro: err && err.message ? err.message : String(err)
        });
        console.error("Erro ao carregar eventos INPE:", config.label, err);
        if (els.eventosStatus) {
          els.eventosStatus.textContent = `Não foi possível carregar ${config.label.toLowerCase()} agora: ${err && err.message ? err.message : err}`;
        }

        return 0;
      }
    }

    async function atualizarCamadasEventos() {
      resetarEventosMapaResumo();
      logEventoDebug("Atualizando camadas de eventos INPE", {
        periodoHoras: Number(els.periodo ? els.periodo.value : 24),
        filtroCidade: textoFiltroCidade() || "Goiás inteiro"
      });

      const ativos = await carregarEventosKml("ativo");
      const observacao = await carregarEventosKml("observacao");

      atualizarResumoEventosMapa();

      const filtro = textoFiltroCidade();
      if (els.eventosStatus) {
        const metaObs = resumoAtualizacaoEventosTexto("observacao");
        const sufixoObs = metaObs ? ` Observação: ${metaObs}.` : "";
        els.eventosStatus.textContent = filtro
          ? `Área selecionada: ${ativos} evento(s) ativo(s) e ${observacao} em observação em ${filtro}.${sufixoObs}`
          : `Área selecionada: ${ativos} evento(s) ativo(s) e ${observacao} em observação em Goiás.${sufixoObs}`;
      }

      logEventoDebug("Fim da atualização dos eventos INPE", {
        eventosNoMapa: eventosMapaTotal,
        ativos,
        observacao
      });
    }

    function tentarGeolocalizacao(silencioso = true) {
      if (!navigator.geolocation) {
        if (!silencioso) setStatus("Seu navegador não suporta localização.", "warn");
        return;
      }

      navigator.geolocation.getCurrentPosition((pos) => {
        userLocated = true;
        registrarUltimaLocalizacao(pos);
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        userInsideGoias = pontoDentroDeGoias(lat, lon);
        layerUser.clearLayers();

        const userIcon = L.divIcon({
          className: "",
          html: '<div class="user-pin" style="display:block!important;width:20px!important;height:20px!important;min-width:20px!important;min-height:20px!important;border-radius:999px!important;background:#1677ff!important;border:3px solid #fff!important;box-sizing:border-box!important;box-shadow:0 0 0 5px rgba(74,163,255,.28),0 3px 12px rgba(0,0,0,.75)!important;"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        L.circle([lat, lon], {
          radius: Math.max(60, pos.coords.accuracy || 60),
          color: "#4aa3ff",
          weight: 1,
          fillColor: "#4aa3ff",
          fillOpacity: 0.12
        }).addTo(layerUser);

        L.marker([lat, lon], { icon: userIcon }).addTo(layerUser)
          .bindPopup(userInsideGoias ? "Sua localização em Goiás" : "Sua localização");

        if (userInsideGoias) {
          map.setView([lat, lon], Math.max(11, map.getMinZoom()));
        }
      }, () => {
        userLocated = false;
        userInsideGoias = false;
        if (!silencioso) {
          setStatus("Não foi possível acessar sua localização. Verifique a permissão do navegador.", "warn");
        }
      }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      });
    }

    function irParaMinhaLocalizacao() {
      mostrarLoading(true);
      setStatus("Buscando sua localização...", "warn");

      if (!navigator.geolocation) {
        mostrarLoading(false);
        setStatus("Seu navegador não suporta localização.", "warn");
        return;
      }

      navigator.geolocation.getCurrentPosition((pos) => {
        mostrarLoading(false);
        userLocated = true;
        registrarUltimaLocalizacao(pos);

        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        userInsideGoias = pontoDentroDeGoias(lat, lon);
        layerUser.clearLayers();

        const userIcon = L.divIcon({
          className: "",
          html: '<div class="user-pin" style="display:block!important;width:20px!important;height:20px!important;min-width:20px!important;min-height:20px!important;border-radius:999px!important;background:#1677ff!important;border:3px solid #fff!important;box-sizing:border-box!important;box-shadow:0 0 0 5px rgba(74,163,255,.28),0 3px 12px rgba(0,0,0,.75)!important;"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        L.circle([lat, lon], {
          radius: Math.max(60, pos.coords.accuracy || 60),
          color: "#4aa3ff",
          weight: 1,
          fillColor: "#4aa3ff",
          fillOpacity: 0.12
        }).addTo(layerUser);

        L.marker([lat, lon], { icon: userIcon }).addTo(layerUser)
          .bindPopup(userInsideGoias ? "Sua localização em Goiás" : "Sua localização")
          .openPopup();

        map.setView([lat, lon], Math.max(userInsideGoias ? 12 : 10, map.getMinZoom()));

        const atualizado = new Date().toLocaleString("pt-BR");
        if (userInsideGoias) {
          setStatus(`Mapa centralizado na sua localização em Goiás. Atualizado em ${atualizado}.`, "ok");
        } else {
          setStatus(`Mapa centralizado na sua localização. Você parece estar fora de Goiás. Atualizado em ${atualizado}.`, "warn");
        }
      }, () => {
        mostrarLoading(false);
        setStatus("Não foi possível acessar sua localização. Verifique a permissão do navegador.", "warn");
      }, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 300000
      });
    }

    function mostrarLoading(show) {
      // Aviso central removido: a atualização agora é informada apenas pelo status verde/amarelo.
      if (!els.loading) return;
      els.loading.classList.remove("show");
      els.loading.setAttribute("aria-hidden", "true");
    }

    function fetchComTimeout(url, options = {}, timeoutMs = 14000) {
      if (typeof AbortController === "undefined") {
        return Promise.race([
          fetch(url, options),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout de rede")), timeoutMs))
        ]);
      }

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      return fetch(url, Object.assign({}, options, { signal: controller.signal }))
        .finally(() => clearTimeout(id));
    }

    function distanciaKm(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = (Number(lat2) - Number(lat1)) * Math.PI / 180;
      const dLon = (Number(lon2) - Number(lon1)) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(Number(lat1) * Math.PI / 180) * Math.cos(Number(lat2) * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function bearingGraus(lat1, lon1, lat2, lon2) {
      const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
      const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
        Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
      return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    function direcaoCardinal(graus) {
      if (!Number.isFinite(graus)) return "--";
      const dirs = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
      return dirs[Math.round((((graus % 360) + 360) % 360) / 45) % 8];
    }

    function formatarDistanciaOperacional(km) {
      if (!Number.isFinite(km)) return "--";
      if (km < 1) return `${Math.round(km * 1000)} m`;
      return `${km.toFixed(km < 10 ? 2 : 1)} km`;
    }

    function formatarDuracaoMin(segundos) {
      const min = Math.round(Number(segundos || 0) / 60);
      if (min < 60) return `${min} min`;
      const h = Math.floor(min / 60);
      const m = min % 60;
      return m ? `${h}h ${m}min` : `${h}h`;
    }

    function obterLocalizacaoAtual() {
      return new Promise((resolve, reject) => {
        if (ultimaLocalizacao && Date.now() - ultimaLocalizacao.timestamp < 2 * 60 * 1000) {
          resolve(ultimaLocalizacao);
          return;
        }

        if (!navigator.geolocation) {
          reject(new Error("Seu navegador não suporta localização."));
          return;
        }

        navigator.geolocation.getCurrentPosition((pos) => {
          const loc = registrarUltimaLocalizacao(pos);
          if (loc) resolve(loc);
          else reject(new Error("Localização inválida."));
        }, () => {
          reject(new Error("Não foi possível acessar sua localização. Verifique a permissão do GPS."));
        }, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 15000
        });
      });
    }

    function registrarUltimaLocalizacao(pos) {
      if (!pos || !pos.coords) return null;

      const lat = Number(pos.coords.latitude);
      const lon = Number(pos.coords.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

      ultimaLocalizacao = {
        lat,
        lon,
        accuracy: Number(pos.coords.accuracy || 0),
        speed: Number(pos.coords.speed || 0),
        heading: Number(pos.coords.heading || 0),
        altitude: Number(pos.coords.altitude || 0),
        timestamp: Date.now()
      };

      atualizarMarcadorUsuario(ultimaLocalizacao);
      atualizarPainelOperacional();
      atualizarNavegacaoInterna(ultimaLocalizacao);

      return ultimaLocalizacao;
    }

    function atualizarMarcadorUsuario(loc) {
      if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) return;

      layerUser.clearLayers();

      const userIcon = L.divIcon({
        className: "user-location-div-icon",
        html: '<div class="user-pin" title="Sua localização" style="display:block!important;width:20px!important;height:20px!important;min-width:20px!important;min-height:20px!important;border-radius:999px!important;background:#1677ff!important;border:3px solid #fff!important;box-sizing:border-box!important;box-shadow:0 0 0 5px rgba(74,163,255,.28),0 3px 12px rgba(0,0,0,.75)!important;"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      L.circle([loc.lat, loc.lon], {
        radius: Math.max(35, loc.accuracy || 35),
        color: "#4aa3ff",
        weight: 1,
        fillColor: "#4aa3ff",
        fillOpacity: 0.12,
        pane: "overlayPane"
      }).addTo(layerUser);

      L.marker([loc.lat, loc.lon], {
        icon: userIcon,
        pane: "paneUserLocation",
        keyboard: false,
        zIndexOffset: 2000
      }).addTo(layerUser)
        .bindPopup("Sua posição GPS no site");

      if (gpsCampoAtivo && seguirGpsAtivo) {
        map.setView([loc.lat, loc.lon], Math.max(15, map.getZoom(), map.getMinZoom()), { animate: true });
      }
    }

    function definirAlvoDoMapa(lat, lon, titulo = "foco/evento", alvoId = "") {
      const la = Number(lat);
      const lo = Number(lon);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) {
        alert("Coordenada inválida para definir alvo.");
        return;
      }

      const alvo = alvoId ? alvosEstradas.get(alvoId) : null;
      const coords = alvo && Array.isArray(alvo.coords) && alvo.coords.length ? alvo.coords : [[la, lo]];

      alvoOperacionalAtual = {
        lat: la,
        lon: lo,
        titulo: String(titulo || "foco/evento"),
        alvoId: String(alvoId || ""),
        coords,
        definidoEm: Date.now()
      };

      layerAlvoOperacional.clearLayers();
      L.marker([la, lo], {
        icon: L.divIcon({
          className: "",
          html: '<div class="marker-target"></div>',
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        }),
        pane: "paneRota"
      }).bindPopup("Alvo operacional: " + escapeHtml(alvoOperacionalAtual.titulo)).addTo(layerAlvoOperacional);

      atualizarPainelOperacional();
      atualizarBotoesPainelFoco();
      map.setView([la, lo], Math.max(14, map.getZoom(), map.getMinZoom()), { animate: true });
      setStatus("Alvo operacional definido. Use o botão “Rota até alvo” no painel.", "ok");
      agendarSalvamentoOfflineAutomatico();
    }

    function pontoDestino(lat, lon, bearing, distanciaKmValor) {
      const R = 6371;
      const brng = Number(bearing) * Math.PI / 180;
      const d = Number(distanciaKmValor) / R;
      const lat1 = Number(lat) * Math.PI / 180;
      const lon1 = Number(lon) * Math.PI / 180;

      const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(d) +
        Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
      );

      const lon2 = lon1 + Math.atan2(
        Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
      );

      return [
        lat2 * 180 / Math.PI,
        ((lon2 * 180 / Math.PI + 540) % 360) - 180
      ];
    }

    function desenharAreaAcaoAlvo() {
      if (!alvoOperacionalAtual) {
        alert("Nenhum alvo definido.");
        return;
      }

      const lat = Number(alvoOperacionalAtual.lat);
      const lon = Number(alvoOperacionalAtual.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        alert("Coordenada do alvo inválida.");
        return;
      }

      layerAreaAcao.clearLayers();

      const raios = [
        { r: 500, km: 0.5, label: "Raio 0,5 km" },
        { r: 1000, km: 1, label: "Raio 1 km" },
        { r: 2000, km: 2, label: "Raio 2 km" }
      ];

      raios.forEach((item) => {
        const cor = item.r === 500 ? "#fff66d" : item.r === 1000 ? "#ffd166" : "#ff9f1c";

        L.circle([lat, lon], {
          radius: item.r,
          color: cor,
          weight: item.r === 500 ? 3 : 2,
          fill: false,
          opacity: 0.95,
          dashArray: item.r === 500 ? "" : "8 8",
          pane: "paneRota"
        }).addTo(layerAreaAcao);

        const labelPos = pontoDestino(lat, lon, item.r === 500 ? 72 : item.r === 1000 ? 84 : 96, item.km);
        L.tooltip({
          permanent: true,
          direction: "center",
          className: "raio-cerco-label",
          pane: "paneRota",
          interactive: false
        })
          .setLatLng(labelPos)
          .setContent(item.label)
          .addTo(layerAreaAcao);
      });

      for (let b = 0; b < 360; b += 45) {
        const p = pontoDestino(lat, lon, b, 2);
        L.polyline([[lat, lon], p], {
          color: "#ffffff",
          weight: 1,
          opacity: 0.35,
          dashArray: "4 8",
          pane: "paneRota",
          interactive: false
        }).addTo(layerAreaAcao);
      }

      if (alvoOperacionalAtual.coords && alvoOperacionalAtual.coords.length > 1) {
        L.polyline(alvoOperacionalAtual.coords, {
          color: "#fffb8a",
          weight: 4,
          opacity: 0.95,
          pane: "paneRota"
        }).addTo(layerAreaAcao);
      }

      map.fitBounds(L.latLngBounds([
        pontoDestino(lat, lon, 315, 2.1),
        pontoDestino(lat, lon, 135, 2.1)
      ]).pad(0.15), { animate: true });

      atualizarBotaoCerco();
      atualizarBotoesPainelFoco();
      agendarSalvamentoOfflineAutomatico();
    }

    async function atualizar(opcoes = {}) {
      const silencioso = !!(opcoes && opcoes.silencioso);
      const horas = Number(els.periodo.value || 24);

      if (atualizacaoEmAndamento) {
        if (!silencioso) setStatus("Atualização já em andamento. Aguarde terminar para atualizar novamente.", "warn");
        return;
      }

      atualizacaoEmAndamento = true;
      if (!silencioso) mostrarLoading(true);

      if (navigator.onLine === false) {
        if (!silencioso) {
          carregarMapaOfflineSalvo();
          mostrarLoading(false);
        }
        atualizacaoEmAndamento = false;
        return;
      }

      if (!silencioso) setStatus("Buscando dados do INPE e atualizando as fontes...", "warn");
      estadoOfflineCarregadoNestaSessao = false;
      eventosCache.ativos = null;
      eventosCache.observacao = null;

      try {
        await carregarLimiteGoias();
        await carregarMunicipiosGoias();
        atualizarDestaqueMunicipioSelecionado();
        if (!silencioso) tentarGeolocalizacao(true);

        const urls = gerarUrlsCsv(horas);
        let csvsLidos = 0;
        let focos = [];

        const lote = 12;

        for (let i = 0; i < urls.length; i += lote) {
          const grupo = urls.slice(i, i + lote);

          const resultados = await Promise.all(grupo.map(async (url) => {
            try {
              const dados = await carregarCsv(url);
              if (dados.length > 0) csvsLidos++;
              return dados;
            } catch (_) {
              return [];
            }
          }));

          focos.push(...resultados.flat());
        }

        if (!focos.length) {
          if (!silencioso) setStatus("CSV de 10 minutos ainda não disponível. Tentando CSV diário do INPE...", "warn");
          const fallback = await carregarFocosDiarioFallback(horas);
          focos = fallback.focos;
          csvsLidos += fallback.csvsLidos;
        }

        const limiteTempo = Date.now() - horas * 60 * 60 * 1000;
        const filtroCidade = textoFiltroCidade();

        focos = focos
          .filter(f => !f.timestamp || f.timestamp >= limiteTempo)
          .filter(f => pontoDentroDeGoias(f.lat, f.lon))
          .filter(f => pontoDentroDoFiltroMunicipio(f.lat, f.lon))
          .map(f => {
            f.municipioFiltro = filtroCidade;
            return f;
          });

        focos = deduplicar(focos);
        focosAtuais = focos;

        await carregarDadosExtrasBDQueimadas(focos);
        desenharFocos(focos);
        if (els.csvsLidos) els.csvsLidos.textContent = String(csvsLidos);

        const atualizado = new Date().toLocaleString("pt-BR");
        const filtroStatus = textoFiltroCidade();
        const origemStatus = focos.some(f => String(f.fonte || "").includes("/diario/"))
          ? " usando fallback diário do INPE"
          : "";
        if (!silencioso) {
          setStatus(filtroStatus ? `Consulta feita em: ${atualizado}${origemStatus}. Filtro: ${filtroStatus}. Estado salvo automaticamente para uso sem internet.` : `Consulta feita em: ${atualizado}${origemStatus}. Estado salvo automaticamente para uso sem internet.`, focos.length === 0 ? "warn" : "ok");
        }

        if (!silencioso && !userInsideGoias && !userLocated) {
          zoomGoias();
        }

        await atualizarCamadasEventos();

        await salvarEstadoOfflineAutomatico({ salvarTiles: true });
      } catch (err) {
        if (silencioso) {
          console.warn("Atualização automática falhou; mantendo dados atuais:", err);
        } else {
          console.warn("Falha na atualização online, tentando estado salvo:", err);
          const abriu = carregarMapaOfflineSalvo();
          if (!abriu) {
            setStatus("Falha ao atualizar pela internet e não há estado salvo para abrir offline.", "warn");
          }
        }
      } finally {
        if (!silencioso) mostrarLoading(false);
        atualizacaoEmAndamento = false;
      }
    }

    function exportarDadosTexto() {
      const linhas = [
        "fonte,lat,lon,satelite,visto_pelo_satelite,classificacao_visual,tempo_desde_a_deteccao,municipio_filtro,municipio_bdq,estado,bioma,risco_fogo,precipitacao,dias_sem_chuva,frp"
      ];

      focosAtuais.forEach((f) => {
        linhas.push([
          "INPE 10 min",
          f.lat,
          f.lon,
          f.satelite || "",
          f.dataLocal || "",
          f.infoVisual ? f.infoVisual.label : "",
          f.tempoAtual || formatarTempoAteAgora(f.timestamp),
          f.municipioFiltro || "",
          f.extraBDQ ? f.extraBDQ.municipio || "" : "",
          f.extraBDQ ? f.extraBDQ.estado || "" : "",
          f.extraBDQ ? f.extraBDQ.bioma || "" : "",
          f.extraBDQ ? f.extraBDQ.riscoFogo || "" : "",
          f.extraBDQ ? f.extraBDQ.precipitacao || "" : "",
          f.extraBDQ ? f.extraBDQ.diasSemChuva || "" : "",
          f.extraBDQ ? f.extraBDQ.frp || "" : ""
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
      });

      return linhas.join("\n");
    }

    async function copiarTexto(texto, okMsg) {
      try {
        await navigator.clipboard.writeText(texto);
        alert(okMsg);
      } catch (_) {
        const w = window.open("", "_blank");
        if (w) {
          w.document.write("<pre style='white-space:pre-wrap;font:13px monospace'>" + escapeHtml(texto) + "</pre>");
          w.document.close();
        } else {
          prompt("Copie abaixo:", texto);
        }
      }
    }

    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    document.getElementById("btnAtualizar").addEventListener("click", atualizar);
    document.getElementById("btnMinhaLocalizacao").addEventListener("click", irParaMinhaLocalizacao);
    if (document.getElementById("btnCopiarDados")) {
      document.getElementById("btnCopiarDados").addEventListener("click", () => {
        copiarTexto(exportarDadosTexto(), "Dados copiados em formato CSV.");
      });
    }
if (document.getElementById("btnRotaAlvo")) {
      document.getElementById("btnRotaAlvo").addEventListener("click", rotaParaAlvoOperacional);
    }

    if (document.getElementById("btnNavegarRotaInterna")) {
      document.getElementById("btnNavegarRotaInterna").addEventListener("click", iniciarNavegacaoDaRotaAtual);
    }

    if (document.getElementById("btnPararNavegacaoInterna")) {
      document.getElementById("btnPararNavegacaoInterna").addEventListener("click", pararNavegacaoInterna);
    }

    if (document.getElementById("btnLimparRotaAcessoPainel")) {
      document.getElementById("btnLimparRotaAcessoPainel").addEventListener("click", limparRotaAcesso);
    }

    if (document.getElementById("btnAreaAcaoAlvo")) {
      document.getElementById("btnAreaAcaoAlvo").addEventListener("click", limparAreaAcao);
    }

    if (document.getElementById("btnCopiarAlvo")) {
      document.getElementById("btnCopiarAlvo").addEventListener("click", copiarAlvoOperacional);
    }

if (document.getElementById("btnLimparAlvo")) {
      document.getElementById("btnLimparAlvo").addEventListener("click", limparAlvoOperacional);
    }

if (document.getElementById("btnMarcarBase")) {
      document.getElementById("btnMarcarBase").addEventListener("click", () => iniciarMarcacaoOperacional("base"));
    }

if (document.getElementById("btnCancelarMarcacaoOp")) {
      document.getElementById("btnCancelarMarcacaoOp").addEventListener("click", cancelarMarcacaoOperacional);
    }
    if (document.getElementById("btnToggleRota")) {
      document.getElementById("btnToggleRota").addEventListener("click", alternarGravacaoRota);
    }
if (document.getElementById("btnLimparRota")) {
      document.getElementById("btnLimparRota").addEventListener("click", limparRotaPercorrida);
    }

    function pontoClienteDoEvento(ev) {
      const e = ev && ev.touches && ev.touches.length ? ev.touches[0] : ev;
      if (!e || !Number.isFinite(Number(e.clientX)) || !Number.isFinite(Number(e.clientY))) return null;
      return { x: Number(e.clientX), y: Number(e.clientY) };
    }

    function abrirFocoMaisProximoPorClique(ev, origem = "captura-container") {
      if (!Array.isArray(focosClicaveisNoMapa) || !focosClicaveisNoMapa.length) return false;

      const ptCliente = pontoClienteDoEvento(ev);
      if (!ptCliente) return false;

      const rect = map.getContainer().getBoundingClientRect();
      const clique = L.point(ptCliente.x - rect.left, ptCliente.y - rect.top);

      let melhor = null;
      for (const item of focosClicaveisNoMapa) {
        if (!item || !item.marker || !Number.isFinite(item.lat) || !Number.isFinite(item.lon)) continue;
        const p = map.latLngToContainerPoint([item.lat, item.lon]);
        const dist = p.distanceTo(clique);
        if (!melhor || dist < melhor.dist) {
          melhor = { item, dist };
        }
      }

      if (!melhor || melhor.dist > 34) return false;

      try {
        ev.preventDefault();
        ev.stopPropagation();
      } catch (_) {}

      if (map.getPane("popupPane")) {
        map.getPane("popupPane").style.zIndex = 1500;
        map.getPane("popupPane").style.pointerEvents = "auto";
      }

      registrarLogPopupFoco("captura container abriu foco", {
        origem,
        distanciaPx: Math.round(melhor.dist),
        lat: melhor.item.lat,
        lon: melhor.item.lon,
        label: melhor.item.label
      });

      abrirPainelFocoOpcoes(melhor.item.html || "", origem);

      try {
        melhor.item.marker.openPopup();
        setTimeout(() => {
          registrarLogPopupFoco("apos captura openPopup fallback", {
            popupAberto: melhor.item.marker.isPopupOpen ? melhor.item.marker.isPopupOpen() : null
          });
        }, 80);
      } catch (err) {
        registrarLogPopupFoco("erro captura openPopup fallback", {
          erro: err && err.message ? err.message : String(err)
        });
      }

      return true;
    }

    function instalarCapturaCliqueFoco() {
      const container = map.getContainer();
      if (!container || container.dataset.fireCaptureReady === "1") return;
      container.dataset.fireCaptureReady = "1";

      container.addEventListener("click", (ev) => {
        abrirFocoMaisProximoPorClique(ev, "container-click-capture");
      }, true);

      container.addEventListener("touchstart", (ev) => {
        abrirFocoMaisProximoPorClique(ev, "container-touch-capture");
      }, { capture: true, passive: false });

      registrarLogPopupFoco("captura de clique instalada", {});
    }

    function atualizarBloqueioOrientacaoHorizontal() {
      const largura = window.innerWidth || document.documentElement.clientWidth || 0;
      const altura = window.innerHeight || document.documentElement.clientHeight || 0;
      const toque = (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || ("ontouchstart" in window);
      const retrato = altura > largura;
      const celularOuTelaPequena = Math.min(largura, altura) <= 900;

      document.body.classList.toggle("mobile-portrait-block", !!(toque && celularOuTelaPequena && retrato));

      if (map && typeof map.invalidateSize === "function") {
        setTimeout(() => map.invalidateSize(), 250);
      }
    }

    atualizarBloqueioOrientacaoHorizontal();
    window.addEventListener("resize", atualizarBloqueioOrientacaoHorizontal);
    window.addEventListener("orientationchange", () => {
      setTimeout(atualizarBloqueioOrientacaoHorizontal, 250);
      setTimeout(atualizarBloqueioOrientacaoHorizontal, 800);
    });

    map.on("moveend", () => {
      if (navigator.onLine !== false) {
        agendarSalvamentoOfflineAutomatico(1800, true);
      }
    });

    window.addEventListener("online", () => {
      atualizarAutomaticamente();
    });

    window.addEventListener("offline", () => {
      carregarMapaOfflineSalvo();
    });

    ["pointerdown", "touchstart", "wheel", "keydown", "click", "input", "change"].forEach((evento) => {
      document.addEventListener(evento, registrarInteracaoUsuario, { capture: true, passive: true });
    });
    map.on("movestart zoomstart dragstart popupopen click", registrarInteracaoUsuario);

    map.on("click", (ev) => {
      registrarLogPopupFoco("clique geral no mapa", {
        latlng: ev && ev.latlng ? { lat: ev.latlng.lat, lon: ev.latlng.lng } : null
      });

      if (aceiroManualAtivo) {
        adicionarPontoAceiroManual(ev.latlng);
        return;
      }
      if (modoMarcacaoOperacional) {
        adicionarPontoOperacional(ev.latlng);
        return;
      }
    });


    if (document.getElementById("btnFecharPainelEvento")) {
      document.getElementById("btnFecharPainelEvento").addEventListener("click", fecharPainelEventoOpcoes);
    }

    if (document.getElementById("btnFecharPainelCercoManual")) {
      document.getElementById("btnFecharPainelCercoManual").addEventListener("click", fecharPainelCercoManualOpcoes);
    }

    if (document.getElementById("btnFecharPainelBase")) {
      document.getElementById("btnFecharPainelBase").addEventListener("click", fecharPainelBaseOpcoes);
    }

    if (document.getElementById("btnFecharPainelFoco")) {
      document.getElementById("btnFecharPainelFoco").addEventListener("click", fecharPainelFocoOpcoes);
    }
els.periodo.addEventListener("change", atualizar);
    if (els.municipio) els.municipio.addEventListener("change", atualizar);
    if (els.busca) els.busca.addEventListener("input", renderizarLista);

    if (window.location.protocol === "file:") {
      setStatus("Abra pelo arquivo abrir_site_localhost.bat. Abrir index.html direto pode bloquear fontes externas.", "warn");
    }

    carregarRotaLocal();
if (document.getElementById("btnLimparBases")) {
      document.getElementById("btnLimparBases").addEventListener("click", limparBasesOperacionais);
    }

    carregarPontosOperacionais();
    atualizarBotaoCerco();
    atualizarBotoesNavegacaoInterna();
    atualizarPainelOperacional();
    registrarServiceWorkerOffline();
    tentarCarregarOfflineSeSemInternet();
    instalarCapturaCliqueFoco();
    registrarLogPopupFoco("app iniciado", { build: "1782947139" });

    atualizar();
setInterval(() => {
      atualizarAutomaticamente();
    }, 10 * 60 * 1000);
