// ============================================================
// TTI | CORRETOR 360 — Player de Vídeos
// ============================================================
// Carrega vídeos locais, navega entre módulos/aulas,
// salva progresso no localStorage, funciona offline.
// ============================================================

(function () {
  'use strict';

  // --- Estado da aplicação ---
  const STORAGE_KEY = 'tti_corretor360_progresso';

  let estado = {
    moduloAtual: null,      // índice do módulo aberto (número)
    aulaAtual: null,        // chave "moduloId_aulaId" (string)
    historico: {}           // { "moduloId_aulaId": true } — aulas concluídas
  };

  // --- Referências do DOM ---
  const els = {
    sidebar:        document.getElementById('sidebar'),
    overlay:        document.getElementById('sidebarOverlay'),
    menuToggle:     document.getElementById('menuToggle'),
    moduleList:     document.getElementById('moduleList'),
    videoPlayer:    document.getElementById('videoPlayer'),
    videoSource:    document.getElementById('videoSource'),
    videoPlaceholder: document.getElementById('videoPlaceholder'),
    lessonTitle:    document.getElementById('lessonTitle'),
    breadcrumb:     document.getElementById('breadcrumb'),
    moduleDesc:     document.getElementById('moduleDesc'),
    moduleDescText: document.getElementById('moduleDescText'),
    btnAnterior:    document.getElementById('btnAnterior'),
    btnProximo:     document.getElementById('btnProximo'),
    btnConcluir:    document.getElementById('btnConcluir'),
    progressBar:    document.getElementById('progressBar'),
    progressText:   document.getElementById('progressText'),
    totalAulas:     document.getElementById('totalAulas'),
    concluidas:     document.getElementById('concluidas')
  };

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================
  function init() {
    carregarProgresso();
    renderizarSidebar();
    restaurarUltimaAula();
    atualizarProgressoGlobal();
    bindEvents();
  }

  function carregarProgresso() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        estado.historico = data.historico || {};
        estado.moduloAtual = data.moduloAtual || null;
        estado.aulaAtual = data.aulaAtual || null;
      }
    } catch (e) {
      console.warn('Erro ao carregar progresso:', e);
      estado.historico = {};
    }
  }

  function salvarProgresso() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        historico: estado.historico,
        moduloAtual: estado.moduloAtual,
        aulaAtual: estado.aulaAtual
      }));
    } catch (e) {
      console.warn('Erro ao salvar progresso:', e);
    }
  }

  // ============================================================
  // SIDEBAR
  // ============================================================
  function renderizarSidebar() {
    els.moduleList.innerHTML = '';

    modulos.forEach((modulo, idx) => {
      const concluidasNoModulo = modulo.aulas.filter(a =>
        estado.historico[`${modulo.id}_${a.id}`]
      ).length;
      const total = modulo.aulas.length;

      const moduloDiv = document.createElement('div');
      moduloDiv.className = 'module-item';

      const header = document.createElement('div');
      header.className = 'module-header';
      if (estado.moduloAtual === idx) {
        header.classList.add('open', 'active-module');
      }
      header.innerHTML = `
        <div class="module-info">
          <div class="module-number">MÓDULO ${idx + 1}</div>
          <div class="module-title">${modulo.titulo}</div>
        </div>
        <div class="module-progress">${concluidasNoModulo}/${total}</div>
        <span class="module-chevron">▶</span>
      `;

      header.addEventListener('click', () => toggleModulo(idx, header));

      const lessonList = document.createElement('div');
      lessonList.className = 'lesson-list';

      modulo.aulas.forEach(aula => {
        const aulaKey = `${modulo.id}_${aula.id}`;
        const concluida = !!estado.historico[aulaKey];
        const ativa = estado.aulaAtual === aulaKey;

        const lessonDiv = document.createElement('div');
        lessonDiv.className = 'lesson-item' + (ativa ? ' active' : '');
        lessonDiv.innerHTML = `
          <span class="lesson-icon ${concluida ? 'done' : ativa ? 'current' : 'pending'}">
            ${concluida ? '✓' : ativa ? '▶' : '○'}
          </span>
          <span class="lesson-title">${aula.titulo}</span>
          <span class="lesson-duration">${aula.duracao}</span>
        `;

        lessonDiv.addEventListener('click', (e) => {
          e.stopPropagation();
          selecionarAula(modulo, aula, idx);
          if (window.innerWidth <= 700) fecharSidebar();
        });

        lessonList.appendChild(lessonDiv);
      });

      moduloDiv.appendChild(header);
      moduloDiv.appendChild(lessonList);
      els.moduleList.appendChild(moduloDiv);
    });

    atualizarTotalAulas();
  }

  function toggleModulo(idx, headerEl) {
    if (estado.moduloAtual === idx) {
      // Fechar
      estado.moduloAtual = null;
      headerEl.classList.remove('open', 'active-module');
    } else {
      // Fechar o anterior
      const anterior = document.querySelector('.module-header.open');
      if (anterior) anterior.classList.remove('open', 'active-module');

      // Abrir este
      estado.moduloAtual = idx;
      headerEl.classList.add('open', 'active-module');
    }
    salvarProgresso();
    atualizarDescricaoModulo();
  }

  // ============================================================
  // PLAYER
  // ============================================================
  function selecionarAula(modulo, aula, moduloIdx) {
    const aulaKey = `${modulo.id}_${aula.id}`;

    estado.aulaAtual = aulaKey;

    // Garantir que o módulo está aberto na sidebar
    if (estado.moduloAtual !== moduloIdx) {
      estado.moduloAtual = moduloIdx;
    }

    // Atualizar sidebar visual
    document.querySelectorAll('.lesson-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.module-header').forEach(el => el.classList.remove('open', 'active-module'));

    // Reabrir módulo correto
    const headers = document.querySelectorAll('.module-header');
    if (headers[moduloIdx]) {
      headers[moduloIdx].classList.add('open', 'active-module');
    }

    // Marcar aula ativa
    const items = document.querySelectorAll('.lesson-item');
    let targetIdx = 0;
    for (let i = 0; i < moduloIdx; i++) {
      targetIdx += modulos[i].aulas.length;
    }
    targetIdx += aula.id - 1;
    if (items[targetIdx]) items[targetIdx].classList.add('active');

    // Carregar vídeo
    carregarVideo(aula.video, aula.titulo, modulo.titulo);

    // Atualizar breadcrumb e título
    els.breadcrumb.textContent = `MÓDULO ${moduloIdx + 1} › ${modulo.titulo}`;
    els.lessonTitle.textContent = aula.titulo;

    // Atualizar descrição do módulo
    els.moduleDescText.textContent = modulo.descricao;
    els.moduleDesc.style.display = 'block';

    // Atualizar botões de navegação
    atualizarBotoesNavegacao(moduloIdx, aula.id);

    // Atualizar botão concluir
    atualizarBotaoConcluir(aulaKey);

    salvarProgresso();
    atualizarProgressoGlobal();

    // Scroll para a aula ativa na sidebar
    if (items[targetIdx]) {
      items[targetIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function carregarVideo(src, titulo, moduloTitulo) {
    els.videoPlaceholder.style.display = 'none';

    // Verificar se o arquivo existe (tentativa)
    els.videoSource.src = src;
    els.videoPlayer.load();
    els.videoPlayer.style.display = 'block';

    // Se o vídeo não carregar, mostrar placeholder
    els.videoPlayer.onerror = function () {
      els.videoPlayer.style.display = 'none';
      els.videoPlaceholder.style.display = 'flex';
    };

    els.videoPlayer.onloadeddata = function () {
      els.videoPlayer.style.display = 'block';
      els.videoPlaceholder.style.display = 'none';
    };

    // Salvar progresso do vídeo
    els.videoPlayer.onpause = function () {
      salvarProgresso();
    };

    // Marcar como concluída ao terminar
    els.videoPlayer.onended = function () {
      if (estado.aulaAtual) {
        estado.historico[estado.aulaAtual] = true;
        salvarProgresso();
        renderizarSidebar();
        atualizarProgressoGlobal();
        atualizarBotaoConcluir(estado.aulaAtual);
      }
    };
  }

  function restaurarUltimaAula() {
    if (estado.aulaAtual) {
      const [moduloIdStr, aulaIdStr] = estado.aulaAtual.split('_');
      const moduloId = parseInt(moduloIdStr);
      const aulaId = parseInt(aulaIdStr);

      for (let mi = 0; mi < modulos.length; mi++) {
        if (modulos[mi].id === moduloId) {
          const aula = modulos[mi].aulas.find(a => a.id === aulaId);
          if (aula) {
            selecionarAula(modulos[mi], aula, mi);
            return;
          }
        }
      }
    }

    // Fallback: primeira aula do primeiro módulo
    if (modulos.length > 0 && modulos[0].aulas.length > 0) {
      selecionarAula(modulos[0], modulos[0].aulas[0], 0);
    }
  }

  // ============================================================
  // NAVEGAÇÃO
  // ============================================================
  function atualizarBotoesNavegacao(moduloIdx, aulaId) {
    const modulo = modulos[moduloIdx];

    // Aula anterior
    if (aulaId > 1) {
      // Aula anterior no mesmo módulo
      els.btnAnterior.disabled = false;
      els.btnAnterior.onclick = () => {
        const anterior = modulo.aulas.find(a => a.id === aulaId - 1);
        if (anterior) selecionarAula(modulo, anterior, moduloIdx);
      };
    } else if (moduloIdx > 0) {
      // Última aula do módulo anterior
      const moduloAnt = modulos[moduloIdx - 1];
      els.btnAnterior.disabled = false;
      els.btnAnterior.onclick = () => {
        const ultima = moduloAnt.aulas[moduloAnt.aulas.length - 1];
        selecionarAula(moduloAnt, ultima, moduloIdx - 1);
      };
    } else {
      els.btnAnterior.disabled = true;
    }

    // Próxima aula
    if (aulaId < modulo.aulas.length) {
      els.btnProximo.disabled = false;
      els.btnProximo.onclick = () => {
        const proxima = modulo.aulas.find(a => a.id === aulaId + 1);
        if (proxima) selecionarAula(modulo, proxima, moduloIdx);
      };
    } else if (moduloIdx < modulos.length - 1) {
      els.btnProximo.disabled = false;
      els.btnProximo.onclick = () => {
        const proxModulo = modulos[moduloIdx + 1];
        selecionarAula(proxModulo, proxModulo.aulas[0], moduloIdx + 1);
      };
    } else {
      els.btnProximo.disabled = true;
    }
  }

  function atualizarBotaoConcluir(aulaKey) {
    if (estado.historico[aulaKey]) {
      els.btnConcluir.textContent = '✓ Concluída';
      els.btnConcluir.classList.add('done');
    } else {
      els.btnConcluir.textContent = '✓ Marcar como concluída';
      els.btnConcluir.classList.remove('done');
    }
  }

  function concluirAula() {
    if (!estado.aulaAtual) return;

    if (estado.historico[estado.aulaAtual]) {
      // Desmarcar
      delete estado.historico[estado.aulaAtual];
    } else {
      // Marcar
      estado.historico[estado.aulaAtual] = true;
    }

    salvarProgresso();
    renderizarSidebar();
    atualizarProgressoGlobal();
    atualizarBotaoConcluir(estado.aulaAtual);
  }

  // ============================================================
  // PROGRESSO GLOBAL
  // ============================================================
  function atualizarProgressoGlobal() {
    let total = 0;
    modulos.forEach(m => { total += m.aulas.length; });

    const concluidas = Object.keys(estado.historico).filter(k => estado.historico[k]).length;
    const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;

    els.progressBar.style.width = pct + '%';
    els.progressText.textContent = pct + '%';
    els.concluidas.textContent = concluidas;
  }

  function atualizarTotalAulas() {
    let total = 0;
    modulos.forEach(m => { total += m.aulas.length; });
    els.totalAulas.textContent = total;
  }

  function atualizarDescricaoModulo() {
    if (estado.moduloAtual !== null) {
      const modulo = modulos[estado.moduloAtual];
      els.moduleDescText.textContent = modulo.descricao;
      els.moduleDesc.style.display = 'block';
    }
  }

  // ============================================================
  // SIDEBAR MOBILE
  // ============================================================
  function abrirSidebar() {
    els.sidebar.classList.add('open');
    els.overlay.classList.add('open');
  }

  function fecharSidebar() {
    els.sidebar.classList.remove('open');
    els.overlay.classList.remove('open');
  }

  // ============================================================
  // KEYBOARD SHORTCUTS
  // ============================================================
  function handleKeyboard(e) {
    // Ignorar se dentro de input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        if (!els.btnAnterior.disabled) els.btnAnterior.click();
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (!els.btnProximo.disabled) els.btnProximo.click();
        break;
      case ' ':
        e.preventDefault();
        if (els.videoPlayer.paused) {
          els.videoPlayer.play();
        } else {
          els.videoPlayer.pause();
        }
        break;
      case 'm':
        els.videoPlayer.muted = !els.videoPlayer.muted;
        break;
      case 'f':
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          els.videoPlayer.requestFullscreen();
        }
        break;
    }
  }

  // ============================================================
  // EVENT BINDING
  // ============================================================
  function bindEvents() {
    els.menuToggle.addEventListener('click', abrirSidebar);
    els.overlay.addEventListener('click', fecharSidebar);
    els.btnConcluir.addEventListener('click', concluirAula);
    document.addEventListener('keydown', handleKeyboard);

    // Fechar sidebar ao redimensionar para desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 700) fecharSidebar();
    });
  }

  // ============================================================
  // START
  // ============================================================
  document.addEventListener('DOMContentLoaded', init);

})();
