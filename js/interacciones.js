document.addEventListener('DOMContentLoaded', function () {

  /* ==========================================================================
     HU6: MODO DE LECTURA NOCTURNA
     ========================================================================== */
  const btnToggleModoNocturno = document.querySelector('#toggle-modo-nocturno');

  if (btnToggleModoNocturno) {
    btnToggleModoNocturno.addEventListener('click', function () {
      document.body.classList.toggle('modo-oscuro');
      const esOscuro = document.body.classList.contains('modo-oscuro');

      btnToggleModoNocturno.textContent = esOscuro ? '☀️ Modo Claro' : '🌙 Modo Nocturno';
      btnToggleModoNocturno.setAttribute(
        'aria-label',
        esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo nocturno'
      );
    });
  }

  /* ==========================================================================
     DATOS DE PLANES Y PAISAJES SONOROS
     ========================================================================== */
  const PLANES_ESTUDIO = {
    ensayo: {
      nombre: 'Redactar un informe',
      bloques: [
        'Leer y comprender la consigna',
        'Buscar fuentes bibliográficas',
        'Redactar borrador inicial',
        'Revisar, citar y dar formato'
      ]
    },
    lectura: {
      nombre: 'Lectura de investigación',
      bloques: [
        'Explorar títulos y objetivos',
        'Leer y subrayar ideas clave',
        'Organizar apuntes',
        'Escribir un resumen'
      ]
    },
    ejercicios: {
      nombre: 'Resolver ejercicios',
      bloques: [
        'Revisar conceptos y ejemplos',
        'Resolver ejercicios iniciales',
        'Resolver casos más difíciles',
        'Comprobar y corregir respuestas'
      ]
    }
  };

  const PAISAJES_SONOROS = {
    marron: {
      nombre: 'Ruido marrón',
      descripcion: 'Frecuencias graves profundas que suavizan el ruido externo y favorecen bloques largos de lectura o análisis.'
    },
    lluvia: {
      nombre: 'Lluvia suave',
      descripcion: 'Cadencia orgánica de frecuencias medias que mantiene un ritmo estable en bloques estándar sin generar fatiga auditiva.'
    },
    blanco: {
      nombre: 'Ruido blanco',
      descripcion: 'Espectro uniforme y suave ideal para enmascarar conversaciones repentinas o entornos compartidos.'
    }
  };

  const ORDEN_PAISAJES = ['marron', 'lluvia', 'blanco'];

  // Estado del planificador (#hu3/#hu5)
  const planBorrador = {
    planId: 'ensayo',
    bloqueIndex: 0,
    minutos: 25
  };

  // Estado de la sesión cargada en #hu1
  const sesionActiva = {
    planId: 'ensayo',
    bloqueIndex: 0,
    minutos: 25,
    segundosRestantes: 25 * 60,
    enEjecucion: false,
    iniciadaAlgunaVez: false,
    completada: false
  };

  let temporizadorInterval = null;

  /* ==========================================================================
     MOTOR DE AUDIO LOCAL (WEB AUDIO API - CERO ARCHIVOS EXTERNOS)
     ========================================================================== */
  const MotorAcustico = (function () {
    let ctx = null;
    let fuenteActual = null;
    let nodoGananciaAmbiente = null;
    let lfoLluvia = null;
    let activo = false;
    let tipoActual = 'lluvia';
    let volumen = 0.35;

    function asegurarContexto() {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!ctx) {
        ctx = new AudioCtx();
      }
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      return ctx;
    }

    function crearBufferRuido(audioCtx, tipo) {
      const duracionSeg = 3;
      const tamano = audioCtx.sampleRate * duracionSeg;
      const buffer = audioCtx.createBuffer(1, tamano, audioCtx.sampleRate);
      const datos = buffer.getChannelData(0);

      if (tipo === 'marron') {
        let ultimo = 0;
        for (let i = 0; i < tamano; i++) {
          const blanco = Math.random() * 2 - 1;
          datos[i] = (ultimo + 0.02 * blanco) / 1.02;
          ultimo = datos[i];
          datos[i] *= 3.2;
        }
      } else if (tipo === 'lluvia') {
        // Ruido rosa aproximado para textura natural de lluvia
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < tamano; i++) {
          const blanco = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + blanco * 0.0555179;
          b1 = 0.99332 * b1 + blanco * 0.0750759;
          b2 = 0.96900 * b2 + blanco * 0.1538520;
          b3 = 0.86650 * b3 + blanco * 0.3104856;
          b4 = 0.55000 * b4 + blanco * 0.5329522;
          b5 = -0.7616 * b5 - blanco * 0.0168980;
          datos[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + blanco * 0.5362) * 0.055;
          b6 = blanco * 0.115926;
        }
      } else {
        // Ruido blanco suave
        for (let i = 0; i < tamano; i++) {
          datos[i] = (Math.random() * 2 - 1) * 0.35;
        }
      }

      return buffer;
    }

    function detenerNodosAmbiente(inmediato) {
      if (lfoLluvia) {
        try { lfoLluvia.stop(); } catch (_) {}
        lfoLluvia = null;
      }

      if (nodoGananciaAmbiente && ctx) {
        const ahora = ctx.currentTime;
        nodoGananciaAmbiente.gain.cancelScheduledValues(ahora);
        if (inmediato) {
          nodoGananciaAmbiente.gain.setValueAtTime(0.0001, ahora);
        } else {
          nodoGananciaAmbiente.gain.setTargetAtTime(0.0001, ahora, 0.08);
        }
      }

      const fuenteAnterior = fuenteActual;
      fuenteActual = null;
      if (fuenteAnterior) {
        setTimeout(function () {
          try { fuenteAnterior.stop(); } catch (_) {}
          try { fuenteAnterior.disconnect(); } catch (_) {}
        }, inmediato ? 20 : 250);
      }
    }

    function reproducirAmbiente(tipo) {
      const audioCtx = asegurarContexto();
      if (!audioCtx) return false;

      tipoActual = tipo || tipoActual;
      detenerNodosAmbiente(true);

      const fuente = audioCtx.createBufferSource();
      fuente.buffer = crearBufferRuido(audioCtx, tipoActual);
      fuente.loop = true;

      const filtro = audioCtx.createBiquadFilter();
      if (tipoActual === 'marron') {
        filtro.type = 'lowpass';
        filtro.frequency.value = 460;
      } else if (tipoActual === 'lluvia') {
        filtro.type = 'bandpass';
        filtro.frequency.value = 950;
        filtro.Q.value = 0.55;
      } else {
        filtro.type = 'lowpass';
        filtro.frequency.value = 3200;
      }

      const ganancia = audioCtx.createGain();
      const ahora = audioCtx.currentTime;
      ganancia.gain.setValueAtTime(0.0001, ahora);
      ganancia.gain.setTargetAtTime(Math.max(0.001, volumen * 0.55), ahora, 0.2);

      // Modulación orgánica muy sutil para simular gotas/brisa en la lluvia
      if (tipoActual === 'lluvia') {
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.frequency.value = 0.18;
        lfoGain.gain.value = 0.04;
        lfo.connect(lfoGain);
        lfoGain.connect(ganancia.gain);
        lfo.start();
        lfoLluvia = lfo;
      }

      fuente.connect(filtro);
      filtro.connect(ganancia);
      ganancia.connect(audioCtx.destination);
      fuente.start();

      fuenteActual = fuente;
      nodoGananciaAmbiente = ganancia;
      activo = true;
      return true;
    }

    function silenciar(inmediato) {
      detenerNodosAmbiente(Boolean(inmediato));
      activo = false;
    }

    function ajustarVolumen(nuevoVolumen) {
      volumen = Math.min(1, Math.max(0, nuevoVolumen));
      if (activo && nodoGananciaAmbiente && ctx) {
        nodoGananciaAmbiente.gain.setTargetAtTime(
          Math.max(0.0001, volumen * 0.55),
          ctx.currentTime,
          0.08
        );
      }
    }

    // Acorde pentatónico armonioso al finalizar el bloque (reemplaza alert())
    function tocarAcordeCierre() {
      const audioCtx = asegurarContexto();
      if (!audioCtx) return;

      const notas = [523.25, 659.25, 783.99]; // Do5, Mi5, Sol5
      const ahora = audioCtx.currentTime;

      notas.forEach(function (freq, idx) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ahora + idx * 0.16);

        gain.gain.setValueAtTime(0.0001, ahora + idx * 0.16);
        gain.gain.linearRampToValueAtTime(0.11, ahora + idx * 0.16 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, ahora + idx * 0.16 + 2.2);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(ahora + idx * 0.16);
        osc.stop(ahora + idx * 0.16 + 2.3);
      });
    }

    // Pulso muy suave al reincorporarse a la pestaña (si el audio está permitido)
    function tocarPulsoReincorporacion() {
      const audioCtx = asegurarContexto();
      if (!audioCtx) return;

      const ahora = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ahora);
      gain.gain.setValueAtTime(0.0001, ahora);
      gain.gain.linearRampToValueAtTime(0.05, ahora + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.45);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(ahora);
      osc.stop(ahora + 0.5);
    }

    return {
      reproducirAmbiente,
      silenciar,
      ajustarVolumen,
      tocarAcordeCierre,
      tocarPulsoReincorporacion,
      estaActivo: () => activo,
      obtenerTipo: () => tipoActual,
      establecerTipoSinReproducir: (tipo) => { tipoActual = tipo; }
    };
  })();

  /* ==========================================================================
     SELECTORES DEL DOM
     ========================================================================== */
  // HU3 & HU5
  const radiosPlan = document.querySelectorAll('input[name="tipo-plan"]');
  const respuestasPlan = document.querySelectorAll('.resultados .respuesta');
  const selectorIntensidad = document.querySelector('#intensidad-estudio');
  const tiemposBloques = document.querySelectorAll('.tiempo-bloque');
  const resumenBloquesTexto = document.querySelector('#resumen-bloques-texto');
  const resumenDescansoTexto = document.querySelector('#resumen-descanso-texto');
  const btnTransferirSesion = document.querySelector('#btn-transferir-sesion');
  const itemsBloque = document.querySelectorAll('.bloque-item');

  // HU1 Temporizador y Continuidad
  const seccionHu1 = document.querySelector('#hu1');
  const badgeSincronizacion = document.querySelector('#badge-sincronizacion');
  const sesionEtiqueta = document.querySelector('#sesion-etiqueta');
  const tituloBloqueActivo = document.querySelector('#titulo-bloque-activo');
  const metaSesion = document.querySelector('#meta-sesion');
  const relojElemento = document.querySelector('#reloj');
  const estadoPill = document.querySelector('#estado-pill');
  const textoEstado = document.querySelector('#texto-estado');
  const avisoSesion = document.querySelector('#aviso-sesion');

  const btnTimerToggle = document.querySelector('#btn-timer-toggle');
  const btnReiniciarBloque = document.querySelector('#btn-reiniciar-bloque');
  const btnBloqueAnterior = document.querySelector('#btn-bloque-anterior');
  const btnBloqueSiguiente = document.querySelector('#btn-bloque-siguiente');
  const btnsDuracionRapida = document.querySelectorAll('.ajuste-duracion .boton-mini');

  // HU1 Banners suaves (reincorporación y cierre armonioso)
  const bannerReincorporacion = document.querySelector('#banner-reincorporacion');
  const textoReincorporacion = document.querySelector('#texto-reincorporacion');
  const btnReincorporarContinuar = document.querySelector('#btn-reincorporar-continuar');
  const btnReincorporarDistraccion = document.querySelector('#btn-reincorporar-distraccion');

  const bannerCierre = document.querySelector('#banner-cierre');
  const textoCierre = document.querySelector('#texto-cierre');
  const btnCierreSiguiente = document.querySelector('#btn-cierre-siguiente');
  const btnCierreCerrar = document.querySelector('#btn-cierre-cerrar');

  // HU1 Escudo Acústico y HAI
  const tituloRecomendacion = document.querySelector('#titulo-recomendacion');
  const motivoRecomendacion = document.querySelector('#motivo-recomendacion');
  const btnAplicarRecomendacion = document.querySelector('#btn-aplicar-recomendacion');
  const zonaGestosSonido = document.querySelector('#zona-gestos-sonido');
  const chipsSonido = document.querySelectorAll('.chip-sonido');
  const btnAudioToggle = document.querySelector('#btn-audio-toggle');
  const btnSilencioEmergencia = document.querySelector('#btn-silencio-emergencia');
  const sliderVolumen = document.querySelector('#slider-volumen');
  const valorVolumen = document.querySelector('#valor-volumen');
  const estadoAudio = document.querySelector('#estado-audio');
  const chkAlertaPestana = document.querySelector('#chk-alerta-pestana');
  const chkCampanaCierre = document.querySelector('#chk-campana-cierre');
  const btnProbarCierre = document.querySelector('#btn-probar-cierre');

  // Pausa Reflexiva y HU4
  const modalPausaDetails = document.querySelector('#modal-pausa');
  const btnPausaReflexiva = document.querySelector('#btn-pausa-reflexiva');
  const btnContinuarEstudio = document.querySelector('#btn-continuar-estudio');
  const tiempoRestanteModal = document.querySelector('#tiempo-restante-modal');
  const bloqueModalNombre = document.querySelector('#bloque-modal-nombre');
  const btnDistraccion = document.querySelector('#btn-distraccion');
  const displayDistracciones = document.querySelector('#distracciones-count');
  const displaySalidasPestana = document.querySelector('#salidas-pestana-count');

  let contadorDistracciones = 0;
  let contadorSalidasPestana = 0;
  let salidaPestanaTimestamp = null;

  /* ==========================================================================
     UTILIDADES Y RECOMENDACIÓN SONORA TRANSPARENTE (HAI)
     ========================================================================== */
  function formatearTiempo(segundos) {
    const mins = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${String(mins).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
  }

  function obtenerDescanso(minutos) {
    return minutos === 50 ? 10 : 5;
  }

  function obtenerRecomendacionSonora(minutos, planId) {
    if (minutos === 50) {
      return {
        tipo: 'marron',
        titulo: 'Sugerencia para bloque profundo (50 min): Ruido marrón',
        motivo: 'Sus frecuencias graves reducen la fatiga auditiva en sesiones extensas y ayudan a sostener el foco profundo.'
      };
    }
    if (planId === 'ejercicios') {
      return {
        tipo: 'blanco',
        titulo: 'Sugerencia para ejercicios (25 min): Ruido blanco',
        motivo: 'Ofrece un enmascarado uniforme que neutraliza ruidos súbitos mientras resuelves problemas paso a paso.'
      };
    }
    return {
      tipo: 'lluvia',
      titulo: 'Sugerencia para bloque estándar (25 min): Lluvia suave',
      motivo: 'Aporta una cadencia natural de frecuencias medias ideal para sesiones de 25 min sin saturar el oído.'
    };
  }

  function actualizarRecomendacionUI() {
    const rec = obtenerRecomendacionSonora(sesionActiva.minutos, sesionActiva.planId);
    if (tituloRecomendacion) tituloRecomendacion.textContent = rec.titulo;
    if (motivoRecomendacion) motivoRecomendacion.textContent = rec.motivo;
    if (btnAplicarRecomendacion) {
      btnAplicarRecomendacion.dataset.sonidoSugerido = rec.tipo;
    }
  }

  function mostrarAviso(mensaje) {
    if (avisoSesion) avisoSesion.textContent = mensaje;
  }

  function actualizarUIEscudoSonoro(mensajeEstado) {
    const tipo = MotorAcustico.obtenerTipo();
    const activo = MotorAcustico.estaActivo();

    chipsSonido.forEach(chip => {
      const esActual = chip.dataset.sonido === tipo;
      chip.classList.toggle('activo', esActual);
      chip.setAttribute('aria-pressed', String(esActual));
    });

    if (btnAudioToggle) {
      btnAudioToggle.setAttribute('aria-pressed', String(activo));
      btnAudioToggle.textContent = activo
        ? `⏸️ Pausar ${PAISAJES_SONOROS[tipo].nombre}`
        : `🔊 Activar ${PAISAJES_SONOROS[tipo].nombre}`;
    }

    if (estadoAudio) {
      if (mensajeEstado) {
        estadoAudio.textContent = mensajeEstado;
      } else if (activo) {
        estadoAudio.textContent = `Reproduciendo localmente: ${PAISAJES_SONOROS[tipo].nombre} (${sliderVolumen ? sliderVolumen.value : 35}%).`;
      } else {
        estadoAudio.textContent = `Silenciado · Seleccionado: ${PAISAJES_SONOROS[tipo].nombre}.`;
      }
    }
  }

  function seleccionarPaisaje(tipo, iniciarSiEstabaApagado) {
    if (!PAISAJES_SONOROS[tipo]) return;

    if (MotorAcustico.estaActivo() || iniciarSiEstabaApagado) {
      const ok = MotorAcustico.reproducirAmbiente(tipo);
      if (!ok) {
        actualizarUIEscudoSonoro('Tu navegador no soporta Web Audio API.');
        return;
      }
      actualizarUIEscudoSonoro(`Paisaje activo: ${PAISAJES_SONOROS[tipo].nombre} (procesado localmente).`);
    } else {
      MotorAcustico.establecerTipoSinReproducir(tipo);
      actualizarUIEscudoSonoro(`Seleccionado: ${PAISAJES_SONOROS[tipo].nombre} (en espera).`);
    }
  }

  function alternarSiguientePaisaje(direccion) {
    const actual = MotorAcustico.obtenerTipo();
    const idx = ORDEN_PAISAJES.indexOf(actual);
    const paso = direccion === -1 ? -1 : 1;
    const siguienteIdx = (idx + paso + ORDEN_PAISAJES.length) % ORDEN_PAISAJES.length;
    const nuevoTipo = ORDEN_PAISAJES[siguienteIdx];
    seleccionarPaisaje(nuevoTipo, MotorAcustico.estaActivo());
  }

  function silenciarInmediato(origen) {
    MotorAcustico.silenciar(true);
    actualizarUIEscudoSonoro(origen || 'Audio silenciado al instante.');
  }

  /* ==========================================================================
     RENDERIZADO Y SINCRONIZACIÓN HU3/HU5 <-> HU1
     ========================================================================== */
  function verificarEstadoSincronizacion() {
    if (!badgeSincronizacion) return;
    const estaSincronizado =
      planBorrador.planId === sesionActiva.planId &&
      planBorrador.bloqueIndex === sesionActiva.bloqueIndex &&
      planBorrador.minutos === sesionActiva.minutos;

    if (estaSincronizado) {
      badgeSincronizacion.textContent = '✓ Sincronizado con tu plan';
      badgeSincronizacion.classList.remove('pendiente');
    } else {
      badgeSincronizacion.textContent = '↻ Cambios pendientes en el planificador';
      badgeSincronizacion.classList.add('pendiente');
    }
  }

  function actualizarVistaPlanificador() {
    respuestasPlan.forEach(respuesta => {
      respuesta.style.display = respuesta.classList.contains(planBorrador.planId) ? 'block' : 'none';
    });

    const descanso = obtenerDescanso(planBorrador.minutos);
    tiemposBloques.forEach(span => {
      span.textContent = `${planBorrador.minutos} min`;
    });

    if (selectorIntensidad && String(selectorIntensidad.value) !== String(planBorrador.minutos)) {
      selectorIntensidad.value = String(planBorrador.minutos);
    }
    if (resumenBloquesTexto) {
      resumenBloquesTexto.textContent = `4 bloques de ${planBorrador.minutos} min`;
    }
    if (resumenDescansoTexto) {
      resumenDescansoTexto.textContent = `Descansos sugeridos: ${descanso} min entre bloques`;
    }

    itemsBloque.forEach(item => {
      const contenedorPlan = item.closest('.respuesta');
      const esDelPlanActual = contenedorPlan && contenedorPlan.dataset.plan === planBorrador.planId;
      const idx = parseInt(item.dataset.bloqueIndex, 10);
      const seleccionado = esDelPlanActual && idx === planBorrador.bloqueIndex;

      item.classList.toggle('seleccionado', seleccionado);
      item.setAttribute('aria-pressed', String(seleccionado));
    });

    if (btnTransferirSesion) {
      btnTransferirSesion.textContent = `Cargar bloque ${planBorrador.bloqueIndex + 1} (${planBorrador.minutos} min) en el temporizador`;
    }

    verificarEstadoSincronizacion();
  }

  function actualizarVistaTemporizador() {
    const plan = PLANES_ESTUDIO[sesionActiva.planId];
    const nombreBloque = plan.bloques[sesionActiva.bloqueIndex];
    const descanso = obtenerDescanso(sesionActiva.minutos);

    if (sesionEtiqueta) {
      sesionEtiqueta.textContent = `BLOQUE ${sesionActiva.bloqueIndex + 1} DE ${plan.bloques.length} · ${plan.nombre.toUpperCase()}`;
    }
    if (tituloBloqueActivo) {
      tituloBloqueActivo.textContent = nombreBloque;
    }
    if (metaSesion) {
      metaSesion.textContent = `Duración: ${sesionActiva.minutos} min · Descanso sugerido: ${descanso} min`;
    }
    if (relojElemento) {
      relojElemento.textContent = formatearTiempo(sesionActiva.segundosRestantes);
    }

    if (btnBloqueAnterior) {
      btnBloqueAnterior.disabled = sesionActiva.bloqueIndex === 0;
    }
    if (btnBloqueSiguiente) {
      btnBloqueSiguiente.disabled = sesionActiva.bloqueIndex === plan.bloques.length - 1;
    }

    btnsDuracionRapida.forEach(btn => {
      const mins = parseInt(btn.dataset.minutos, 10);
      const activo = mins === sesionActiva.minutos;
      btn.classList.toggle('activo', activo);
      btn.setAttribute('aria-pressed', String(activo));
    });

    if (estadoPill) {
      estadoPill.classList.remove('pausado', 'completado');
    }

    if (sesionActiva.completada) {
      if (estadoPill) estadoPill.classList.add('completado');
      if (textoEstado) textoEstado.textContent = 'Bloque completado · Cierre armonioso';
      if (btnTimerToggle) btnTimerToggle.textContent = 'Repetir este bloque';
    } else if (sesionActiva.enEjecucion) {
      if (textoEstado) textoEstado.textContent = 'Blindaje focal · En curso';
      if (btnTimerToggle) btnTimerToggle.textContent = 'Pausar cronómetro';
    } else if (sesionActiva.iniciadaAlgunaVez) {
      if (estadoPill) estadoPill.classList.add('pausado');
      if (textoEstado) textoEstado.textContent = 'En pausa · Sesión detenida';
      if (btnTimerToggle) btnTimerToggle.textContent = 'Reanudar bloque';
    } else {
      if (estadoPill) estadoPill.classList.add('pausado');
      if (textoEstado) textoEstado.textContent = 'En pausa · Listo para iniciar';
      if (btnTimerToggle) btnTimerToggle.textContent = 'Confirmar e iniciar bloque';
    }

    actualizarRecomendacionUI();
    verificarEstadoSincronizacion();
  }

  /* ==========================================================================
     CONTROL DEL TEMPORIZADOR Y CIERRE ARMONIOSO
     ========================================================================== */
  function detenerIntervalo() {
    if (temporizadorInterval) {
      clearInterval(temporizadorInterval);
      temporizadorInterval = null;
    }
  }

  function ocultarBannersSuaves() {
    if (bannerReincorporacion) bannerReincorporacion.hidden = true;
    if (bannerCierre) bannerCierre.hidden = true;
  }

  function cargarSesionEnPausa({ planId, bloqueIndex, minutos, mensaje }) {
    detenerIntervalo();
    ocultarBannersSuaves();

    sesionActiva.planId = planId;
    sesionActiva.bloqueIndex = bloqueIndex;
    sesionActiva.minutos = minutos;
    sesionActiva.segundosRestantes = minutos * 60;
    sesionActiva.enEjecucion = false;
    sesionActiva.iniciadaAlgunaVez = false;
    sesionActiva.completada = false;

    planBorrador.planId = planId;
    planBorrador.bloqueIndex = bloqueIndex;
    planBorrador.minutos = minutos;

    const radioObjetivo = document.querySelector(`#${planId}`);
    if (radioObjetivo) radioObjetivo.checked = true;

    actualizarVistaPlanificador();
    actualizarVistaTemporizador();
    mostrarAviso(mensaje || 'Bloque cargado en pausa. Confirma cuando quieras comenzar.');
  }

  function finalizarBloqueArmonioso() {
    detenerIntervalo();
    sesionActiva.enEjecucion = false;
    sesionActiva.completada = true;
    actualizarVistaTemporizador();

    // Silenciar suavemente el paisaje sonoro al terminar para marcar el cierre
    if (MotorAcustico.estaActivo()) {
      MotorAcustico.silenciar(false);
      actualizarUIEscudoSonoro('Paisaje sonoro atenuado al completar el bloque.');
    }

    // Reproducir acorde armonioso si el usuario no lo desactivó
    if (!chkCampanaCierre || chkCampanaCierre.checked) {
      MotorAcustico.tocarAcordeCierre();
    }

    const plan = PLANES_ESTUDIO[sesionActiva.planId];
    const descanso = obtenerDescanso(sesionActiva.minutos);
    const haySiguiente = sesionActiva.bloqueIndex < plan.bloques.length - 1;

    if (textoCierre) {
      textoCierre.textContent = haySiguiente
        ? `Completaste "${plan.bloques[sesionActiva.bloqueIndex]}". Toma ${descanso} min de descanso y continúa con el bloque ${sesionActiva.bloqueIndex + 2}.`
        : `¡Completaste todos los bloques de "${plan.nombre}"! Tómate un descanso merecido de ${descanso} min.`;
    }
    if (btnCierreSiguiente) {
      btnCierreSiguiente.hidden = !haySiguiente;
    }
    if (bannerCierre) {
      bannerCierre.hidden = false;
    }

    mostrarAviso(`Bloque completado. Descanso sugerido: ${descanso} min.`);
  }

  function iniciarTemporizador() {
    if (sesionActiva.completada || sesionActiva.segundosRestantes <= 0) {
      sesionActiva.segundosRestantes = sesionActiva.minutos * 60;
      sesionActiva.completada = false;
    }

    ocultarBannersSuaves();
    detenerIntervalo();
    sesionActiva.enEjecucion = true;
    sesionActiva.iniciadaAlgunaVez = true;
    actualizarVistaTemporizador();
    mostrarAviso('Sesión en curso. Mantén tu enfoque en una sola tarea.');

    temporizadorInterval = setInterval(function () {
      if (sesionActiva.segundosRestantes > 0) {
        sesionActiva.segundosRestantes--;
        if (relojElemento) {
          relojElemento.textContent = formatearTiempo(sesionActiva.segundosRestantes);
        }
      } else {
        finalizarBloqueArmonioso();
      }
    }, 1000);
  }

  function pausarTemporizador(motivo) {
    detenerIntervalo();
    sesionActiva.enEjecucion = false;
    actualizarVistaTemporizador();
    mostrarAviso(motivo || 'Cronómetro en pausa. Puedes reanudar o reiniciar cuando quieras.');
  }

  function reiniciarBloque() {
    detenerIntervalo();
    ocultarBannersSuaves();
    sesionActiva.segundosRestantes = sesionActiva.minutos * 60;
    sesionActiva.enEjecucion = false;
    sesionActiva.iniciadaAlgunaVez = false;
    sesionActiva.completada = false;
    actualizarVistaTemporizador();
    mostrarAviso(`Bloque reiniciado a ${sesionActiva.minutos}:00 en estado pausado.`);
  }

  function cambiarBloque(delta) {
    const plan = PLANES_ESTUDIO[sesionActiva.planId];
    const nuevoIndice = sesionActiva.bloqueIndex + delta;
    if (nuevoIndice < 0 || nuevoIndice >= plan.bloques.length) return;

    cargarSesionEnPausa({
      planId: sesionActiva.planId,
      bloqueIndex: nuevoIndice,
      minutos: sesionActiva.minutos,
      mensaje: `Bloque ${nuevoIndice + 1} cargado en pausa: "${plan.bloques[nuevoIndice]}".`
    });
  }

  function registrarDistraccion() {
    contadorDistracciones++;
    if (displayDistracciones) {
      displayDistracciones.textContent = contadorDistracciones;
    }
  }

  /* ==========================================================================
     DETECCIÓN SUAVE DE CAMBIO DE PESTAÑA (PAGE VISIBILITY API)
     ========================================================================== */
  document.addEventListener('visibilitychange', function () {
    if (!sesionActiva.enEjecucion) return;
    if (chkAlertaPestana && !chkAlertaPestana.checked) return;

    if (document.hidden) {
      salidaPestanaTimestamp = Date.now();
    } else if (salidaPestanaTimestamp) {
      const segundosFuera = Math.max(1, Math.round((Date.now() - salidaPestanaTimestamp) / 1000));
      salidaPestanaTimestamp = null;

      contadorSalidasPestana++;
      if (displaySalidasPestana) {
        displaySalidasPestana.textContent = contadorSalidasPestana;
      }

      const plan = PLANES_ESTUDIO[sesionActiva.planId];
      const tareaActual = plan.bloques[sesionActiva.bloqueIndex];

      if (textoReincorporacion) {
        textoReincorporacion.textContent =
          `Cambiaste de pestaña durante ${segundosFuera} s. Retoma con calma tu bloque: "${tareaActual}".`;
      }
      if (bannerReincorporacion) {
        bannerReincorporacion.hidden = false;
      }

      if (MotorAcustico.estaActivo()) {
        MotorAcustico.tocarPulsoReincorporacion();
      }
    }
  });

  /* ==========================================================================
     EVENTOS DE HU3, HU5 Y HU1
     ========================================================================== */
  radiosPlan.forEach(radio => {
    radio.addEventListener('change', function () {
      if (!radio.checked) return;
      planBorrador.planId = radio.id;
      planBorrador.bloqueIndex = 0;
      actualizarVistaPlanificador();
    });
  });

  if (selectorIntensidad) {
    selectorIntensidad.addEventListener('change', function () {
      planBorrador.minutos = parseInt(selectorIntensidad.value, 10) || 25;
      actualizarVistaPlanificador();
    });
  }

  itemsBloque.forEach(item => {
    function seleccionarBloque() {
      const contenedorPlan = item.closest('.respuesta');
      if (!contenedorPlan) return;
      planBorrador.planId = contenedorPlan.dataset.plan;
      planBorrador.bloqueIndex = parseInt(item.dataset.bloqueIndex, 10) || 0;
      actualizarVistaPlanificador();
    }

    item.addEventListener('click', seleccionarBloque);
    item.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        seleccionarBloque();
      }
    });
  });

  if (btnTransferirSesion) {
    btnTransferirSesion.addEventListener('click', function () {
      const plan = PLANES_ESTUDIO[planBorrador.planId];
      const tarea = plan.bloques[planBorrador.bloqueIndex];

      cargarSesionEnPausa({
        planId: planBorrador.planId,
        bloqueIndex: planBorrador.bloqueIndex,
        minutos: planBorrador.minutos,
        mensaje: `Transferido desde tu plan: "${tarea}" (${planBorrador.minutos} min). Confirma para iniciar.`
      });

      if (seccionHu1) {
        seccionHu1.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (btnTimerToggle) {
        btnTimerToggle.focus({ preventScroll: true });
      }
    });
  }

  if (btnTimerToggle) {
    btnTimerToggle.addEventListener('click', function () {
      if (sesionActiva.enEjecucion) {
        pausarTemporizador();
      } else {
        iniciarTemporizador();
      }
    });
  }

  if (btnReiniciarBloque) btnReiniciarBloque.addEventListener('click', reiniciarBloque);
  if (btnBloqueAnterior) btnBloqueAnterior.addEventListener('click', () => cambiarBloque(-1));
  if (btnBloqueSiguiente) btnBloqueSiguiente.addEventListener('click', () => cambiarBloque(1));

  btnsDuracionRapida.forEach(btn => {
    btn.addEventListener('click', function () {
      const nuevosMinutos = parseInt(btn.dataset.minutos, 10) || 25;
      if (nuevosMinutos === sesionActiva.minutos) return;

      cargarSesionEnPausa({
        planId: sesionActiva.planId,
        bloqueIndex: sesionActiva.bloqueIndex,
        minutos: nuevosMinutos,
        mensaje: `Duración ajustada a ${nuevosMinutos} min y sincronizada con tu plan (en pausa).`
      });
    });
  });

  if (btnDistraccion) btnDistraccion.addEventListener('click', registrarDistraccion);

  // Acciones de los banners suaves
  if (btnReincorporarContinuar) {
    btnReincorporarContinuar.addEventListener('click', function () {
      if (bannerReincorporacion) bannerReincorporacion.hidden = true;
      mostrarAviso('Reincorporado a tu bloque actual.');
    });
  }

  if (btnReincorporarDistraccion) {
    btnReincorporarDistraccion.addEventListener('click', function () {
      registrarDistraccion();
      if (bannerReincorporacion) bannerReincorporacion.hidden = true;
      mostrarAviso('Salida registrada como distracción menor. Seguimos enfocados.');
    });
  }

  if (btnCierreSiguiente) {
    btnCierreSiguiente.addEventListener('click', function () {
      cambiarBloque(1);
    });
  }

  if (btnCierreCerrar) {
    btnCierreCerrar.addEventListener('click', function () {
      if (bannerCierre) bannerCierre.hidden = true;
    });
  }

  // Pausa reflexiva
  if (modalPausaDetails && btnPausaReflexiva) {
    btnPausaReflexiva.addEventListener('click', function () {
      if (sesionActiva.enEjecucion) {
        pausarTemporizador('Pausa reflexiva abierta. Decide si deseas continuar.');
      }
      const minsRestantes = Math.ceil(sesionActiva.segundosRestantes / 60);
      if (tiempoRestanteModal) {
        tiempoRestanteModal.textContent = `${minsRestantes} minuto${minsRestantes !== 1 ? 's' : ''}`;
      }
      if (bloqueModalNombre) {
        const plan = PLANES_ESTUDIO[sesionActiva.planId];
        bloqueModalNombre.textContent = plan.bloques[sesionActiva.bloqueIndex];
      }
    });

    if (btnContinuarEstudio) {
      btnContinuarEstudio.addEventListener('click', function () {
        modalPausaDetails.open = false;
        iniciarTemporizador();
      });
    }
  }

  /* ==========================================================================
     EVENTOS DEL ESCUDO ACÚSTICO, GESTOS TÁCTILES Y ATAJOS DE TECLADO
     ========================================================================== */
  chipsSonido.forEach(chip => {
    chip.addEventListener('click', function () {
      seleccionarPaisaje(chip.dataset.sonido, true);
    });
  });

  if (btnAplicarRecomendacion) {
    btnAplicarRecomendacion.addEventListener('click', function () {
      const sugerido = btnAplicarRecomendacion.dataset.sonidoSugerido || 'lluvia';
      seleccionarPaisaje(sugerido, true);
    });
  }

  if (btnAudioToggle) {
    btnAudioToggle.addEventListener('click', function () {
      if (MotorAcustico.estaActivo()) {
        MotorAcustico.silenciar(false);
        actualizarUIEscudoSonoro('Paisaje sonoro en pausa.');
      } else {
        seleccionarPaisaje(MotorAcustico.obtenerTipo(), true);
      }
    });
  }

  if (btnSilencioEmergencia) {
    btnSilencioEmergencia.addEventListener('click', function () {
      silenciarInmediato('Audio silenciado al instante.');
    });
  }

  if (sliderVolumen) {
    sliderVolumen.addEventListener('input', function () {
      const pct = parseInt(sliderVolumen.value, 10) || 0;
      if (valorVolumen) valorVolumen.textContent = `${pct}%`;
      MotorAcustico.ajustarVolumen(pct / 100);
      if (MotorAcustico.estaActivo()) {
        actualizarUIEscudoSonoro();
      }
    });
  }

  if (btnProbarCierre) {
    btnProbarCierre.addEventListener('click', function () {
      MotorAcustico.tocarAcordeCierre();
      actualizarUIEscudoSonoro('Reproduciendo vista previa del acorde de cierre.');
    });
  }

  // Gestos táctiles (Swipe horizontal en la tarjeta de paisajes sonoros)
  if (zonaGestosSonido) {
    let inicioTouchX = 0;
    let inicioTouchY = 0;

    zonaGestosSonido.addEventListener('touchstart', function (e) {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      inicioTouchX = e.changedTouches[0].clientX;
      inicioTouchY = e.changedTouches[0].clientY;
    }, { passive: true });

    zonaGestosSonido.addEventListener('touchend', function (e) {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      const deltaX = e.changedTouches[0].clientX - inicioTouchX;
      const deltaY = e.changedTouches[0].clientY - inicioTouchY;

      // Solo disparar si el deslizamiento es claramente horizontal
      if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
        alternarSiguientePaisaje(deltaX < 0 ? 1 : -1);
      }
    }, { passive: true });
  }

  // Atajos de teclado seguros (ignorados al escribir en campos de formulario)
  document.addEventListener('keydown', function (e) {
    const etiqueta = document.activeElement ? document.activeElement.tagName : '';
    if (etiqueta === 'INPUT' || etiqueta === 'TEXTAREA' || etiqueta === 'SELECT') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const tecla = e.key.toLowerCase();
    if (tecla === 'm') {
      if (MotorAcustico.estaActivo()) {
        silenciarInmediato('Audio silenciado al instante (tecla M).');
      } else {
        seleccionarPaisaje(MotorAcustico.obtenerTipo(), true);
      }
    } else if (tecla === 'n') {
      alternarSiguientePaisaje(1);
    }
  });

  /* ==========================================================================
     CONTROL POR VOZ MULTIMODAL (WEB SPEECH API)
     ========================================================================== */
  const btnVozToggle = document.querySelector('#btn-voz-toggle');
  const vozEstado = document.querySelector('#voz-estado');
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

  let reconocimiento = null;
  let vozActiva = false;

  function normalizarTexto(texto) {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function procesarComandoVoz(transcripcion) {
    const cmd = normalizarTexto(transcripcion);

    // Comandos de paisajes sonoros
    if (cmd.includes('marron')) {
      seleccionarPaisaje('marron', true);
      if (vozEstado) vozEstado.textContent = 'Voz: Ruido marrón activado';
      return;
    }
    if (cmd.includes('blanco')) {
      seleccionarPaisaje('blanco', true);
      if (vozEstado) vozEstado.textContent = 'Voz: Ruido blanco activado';
      return;
    }
    if (cmd.includes('lluvia')) {
      seleccionarPaisaje('lluvia', true);
      if (vozEstado) vozEstado.textContent = 'Voz: Lluvia suave activada';
      return;
    }
    if (cmd.includes('cambiar ambiente') || cmd.includes('siguiente ambiente') || cmd.includes('cambiar sonido')) {
      alternarSiguientePaisaje(1);
      if (vozEstado) vozEstado.textContent = `Voz: Ambiente cambiado a ${PAISAJES_SONOROS[MotorAcustico.obtenerTipo()].nombre}`;
      return;
    }
    if (cmd.includes('silencio') || cmd.includes('silenciar') || cmd.includes('apagar sonido') || cmd.includes('mutear')) {
      silenciarInmediato('Audio silenciado por comando de voz.');
      if (vozEstado) vozEstado.textContent = 'Voz: Audio silenciado';
      return;
    }

    // Comandos del temporizador y bloques
    if (cmd.includes('iniciar') || cmd.includes('comenzar') || cmd.includes('empezar') || cmd.includes('reanudar')) {
      if (!sesionActiva.enEjecucion) iniciarTemporizador();
      if (vozEstado) vozEstado.textContent = 'Voz: Sesión iniciada';
    } else if (cmd.includes('pausar') || cmd.includes('detener') || cmd.includes('parar')) {
      if (sesionActiva.enEjecucion) pausarTemporizador('Pausado por comando de voz.');
      if (vozEstado) vozEstado.textContent = 'Voz: Sesión pausada';
    } else if (cmd.includes('reiniciar') || cmd.includes('resetear')) {
      reiniciarBloque();
      if (vozEstado) vozEstado.textContent = 'Voz: Bloque reiniciado';
    } else if (cmd.includes('siguiente') || cmd.includes('avanzar') || cmd.includes('proximo')) {
      cambiarBloque(1);
      if (vozEstado) vozEstado.textContent = 'Voz: Siguiente bloque';
    } else if (cmd.includes('anterior') || cmd.includes('atras') || cmd.includes('retroceder')) {
      cambiarBloque(-1);
      if (vozEstado) vozEstado.textContent = 'Voz: Bloque anterior';
    } else if (cmd.includes('distraccion') || cmd.includes('interrupcion')) {
      registrarDistraccion();
      if (vozEstado) vozEstado.textContent = 'Voz: +1 Distracción registrada';
    } else {
      if (vozEstado) vozEstado.textContent = `Escuchado: "${transcripcion}" (sin comando)`;
    }
  }

  if (btnVozToggle && vozEstado) {
    if (!SpeechRecognitionAPI) {
      btnVozToggle.disabled = true;
      btnVozToggle.textContent = '🎙️ Voz no disponible';
      vozEstado.textContent = 'Tu navegador no soporta Web Speech API.';
    } else {
      reconocimiento = new SpeechRecognitionAPI();
      reconocimiento.lang = 'es-ES';
      reconocimiento.continuous = true;
      reconocimiento.interimResults = false;

      reconocimiento.onstart = function () {
        vozActiva = true;
        btnVozToggle.classList.add('escuchando');
        btnVozToggle.setAttribute('aria-pressed', 'true');
        btnVozToggle.textContent = '⏹️ Desactivar voz';
        vozEstado.textContent = 'Escuchando comandos...';
      };

      reconocimiento.onresult = function (evento) {
        const ultimoResultado = evento.results[evento.results.length - 1];
        if (ultimoResultado && ultimoResultado[0]) {
          procesarComandoVoz(ultimoResultado[0].transcript);
        }
      };

      reconocimiento.onerror = function (evento) {
        if (evento.error === 'not-allowed') {
          vozActiva = false;
          btnVozToggle.classList.remove('escuchando');
          btnVozToggle.setAttribute('aria-pressed', 'false');
          btnVozToggle.textContent = '🎙️ Activar control por voz';
          vozEstado.textContent = 'Permiso de micrófono denegado.';
        } else if (evento.error !== 'no-speech') {
          vozEstado.textContent = `Error de voz: ${evento.error}`;
        }
      };

      reconocimiento.onend = function () {
        if (vozActiva) {
          try { reconocimiento.start(); } catch (_) {}
        } else {
          btnVozToggle.classList.remove('escuchando');
          btnVozToggle.setAttribute('aria-pressed', 'false');
          btnVozToggle.textContent = '🎙️ Activar control por voz';
          vozEstado.textContent = 'Voz desactivada';
        }
      };

      btnVozToggle.addEventListener('click', function () {
        if (vozActiva) {
          vozActiva = false;
          reconocimiento.stop();
        } else {
          try {
            reconocimiento.start();
          } catch (_) {
            vozEstado.textContent = 'No se pudo iniciar el micrófono.';
          }
        }
      });
    }
  }

  /* ==========================================================================
     HU2: GESTIÓN DE TAREAS Y RECUPERACIÓN (DESHACER)
     ========================================================================== */
  const listaTareas = document.querySelector('#lista-tareas');
  const sinTareasMsg = document.querySelector('#sin-tareas');
  const detailsConfirmar = document.querySelector('#details-confirmar');
  const btnConfirmarEliminar = document.querySelector('#btn-confirmar-eliminar');
  const toastNotificacion = document.querySelector('#toast-notificacion');
  const btnDeshacer = document.querySelector('#btn-deshacer');
  const contadorTareas = document.querySelector('#contador-tareas');

  if (btnConfirmarEliminar && listaTareas && sinTareasMsg && toastNotificacion) {
    btnConfirmarEliminar.addEventListener('click', function () {
      listaTareas.style.display = 'none';
      if (detailsConfirmar) {
        detailsConfirmar.open = false;
        detailsConfirmar.style.display = 'none';
      }

      sinTareasMsg.style.display = 'block';
      toastNotificacion.classList.add('activo');
      if (contadorTareas) contadorTareas.textContent = '0 tareas';
    });

    if (btnDeshacer) {
      btnDeshacer.addEventListener('click', function () {
        listaTareas.style.display = 'block';
        sinTareasMsg.style.display = 'none';
        if (detailsConfirmar) {
          detailsConfirmar.style.display = 'block';
        }

        toastNotificacion.classList.remove('activo');
        if (contadorTareas) contadorTareas.textContent = '3 tareas';
      });
    }
  }

  /* ==========================================================================
     INICIALIZACIÓN (SIEMPRE EN PAUSA Y SIN AUDIO AUTOMÁTICO)
     ========================================================================== */
  if (relojElemento) {
    actualizarVistaPlanificador();
    actualizarVistaTemporizador();
    actualizarUIEscudoSonoro('Audio en espera. El sonido nunca inicia sin tu permiso.');
  }

});