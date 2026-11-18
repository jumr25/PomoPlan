/**
 * interacciones.js - Implementación de las Interacciones JavaScript de PomoPlan (ODS 4)
 * 
 * Funcionalidades implementadas:
 * 1. HU3 (Planificación): Selección dinámica de tipo de plan (Informe, Lectura, Ejercicios) con actualización de vista y resumen.
 * 2. HU5 (Intensidad de Estudio): Selector desplegable para alternar entre bloques estándar (25 min) y profundos (50 min), actualizando textos del DOM.
 * 3. HU1 (Concentración / Blindaje Focal): Temporizador dinámico con inicio/pausa y Modal de Pausa Reflexiva.
 * 4. HU4 (Registro de Distracciones): Botón e incremento dinámico del contador de interrupciones menores sin detener el cronómetro.
 * 5. HU2 (Seguridad al gestionar tareas): Confirmación de vaciado de tareas, vista sin tareas y notificación Toast con función "Deshacer".
 * 6. HU6 (Modo Lectura Nocturna): Conmutador global de tema oscuro/alto contraste en la cabecera.
 */

document.addEventListener('DOMContentLoaded', function () {

  /* ==========================================================================
     HU6: MODO DE LECTURA NOCTURNA (CABECERA)
     ========================================================================== */
  const btnToggleModoNocturno = document.querySelector('#toggle-modo-nocturno');

  if (btnToggleModoNocturno) {
    btnToggleModoNocturno.addEventListener('click', function () {
      document.body.classList.toggle('modo-oscuro');
      const esOscuro = document.body.classList.contains('modo-oscuro');
      
      btnToggleModoNocturno.textContent = esOscuro ? '☀️ Modo Claro' : '🌙 Modo Nocturno';
      btnToggleModoNocturno.setAttribute('aria-label', esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo nocturno');
    });
  }

  /* ==========================================================================
     HU3 & HU5: PLANIFICACIÓN DE AVANCE Y SELECTOR DE INTENSIDAD DE ESTUDIO
     ========================================================================== */
  const radiosPlan = document.querySelectorAll('input[name="tipo-plan"]');
  const respuestasPlan = document.querySelectorAll('.resultados .respuesta');
  const selectorIntensidad = document.querySelector('#intensidad-estudio');
  const tiemposBloques = document.querySelectorAll('.tiempo-bloque');
  const resumenBloquesTexto = document.querySelector('#resumen-bloques-texto');
  const resumenDescansoTexto = document.querySelector('#resumen-descanso-texto');

  // HU3: Cambiar vista según el tipo de plan seleccionado
  if (radiosPlan.length > 0) {
    function actualizarPlan() {
      const planSeleccionado = document.querySelector('input[name="tipo-plan"]:checked');
      if (!planSeleccionado) return;

      const idPlan = planSeleccionado.id; // 'ensayo', 'lectura' o 'ejercicios'

      respuestasPlan.forEach(respuesta => {
        if (respuesta.classList.contains(idPlan)) {
          respuesta.style.display = 'block';
        } else {
          respuesta.style.display = 'none';
        }
      });
    }

    radiosPlan.forEach(radio => {
      radio.addEventListener('change', actualizarPlan);
    });

    actualizarPlan();
  }

  // HU5: Ajuste dinámico de los minutos por bloque (25 min vs 50 min)
  if (selectorIntensidad) {
    selectorIntensidad.addEventListener('change', function () {
      const minutos = parseInt(selectorIntensidad.value, 10) || 25;
      const descanso = minutos === 50 ? 10 : 5;

      // Actualizar textos de duración en cada uno de los pasos
      tiemposBloques.forEach(span => {
        span.textContent = `${minutos} min`;
      });

      // Actualizar resumen del plan
      if (resumenBloquesTexto) {
        resumenBloquesTexto.textContent = `4 bloques de ${minutos} min`;
      }
      if (resumenDescansoTexto) {
        resumenDescansoTexto.textContent = `Descansos sugeridos: ${descanso} min entre bloques`;
      }
    });
  }

  /* ==========================================================================
     HU1 & HU4: BLINDAJE FOCAL, TEMPORIZADOR, PAUSA REFLEXIVA Y DISTRACCIONES
     ========================================================================== */
  const relojElemento = document.querySelector('#reloj');
  const btnTimerToggle = document.querySelector('#btn-timer-toggle');
  const textoEstado = document.querySelector('#texto-estado');
  const puntoEstado = document.querySelector('#punto-estado');
  const modalPausaDetails = document.querySelector('#modal-pausa');
  const btnPausaReflexiva = document.querySelector('#btn-pausa-reflexiva');
  const btnContinuarEstudio = document.querySelector('#btn-continuar-estudio');
  const tiempoRestanteModal = document.querySelector('#tiempo-restante-modal');

  // HU4: Elementos de registro rápido de distracciones
  const btnDistraccion = document.querySelector('#btn-distraccion');
  const displayDistracciones = document.querySelector('#distracciones-count');
  let contadorDistracciones = 0;

  let tiempoTotalSegundos = 25 * 60; // 25 minutos por defecto
  let temporizadorInterval = null;
  let enEjecucion = true;

  function formatearTiempo(segundos) {
    const mins = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${String(mins).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
  }

  function actualizarReloj() {
    if (relojElemento) {
      relojElemento.textContent = formatearTiempo(tiempoTotalSegundos);
    }
  }

  function iniciarTemporizador() {
    if (temporizadorInterval) clearInterval(temporizadorInterval);
    enEjecucion = true;
    
    if (btnTimerToggle) btnTimerToggle.textContent = 'Pausar cronómetro';
    if (textoEstado) textoEstado.textContent = 'Blindaje focal · Activo';
    if (puntoEstado && puntoEstado.parentElement) {
      puntoEstado.parentElement.classList.remove('pausado');
    }

    temporizadorInterval = setInterval(function () {
      if (tiempoTotalSegundos > 0) {
        tiempoTotalSegundos--;
        actualizarReloj();
      } else {
        clearInterval(temporizadorInterval);
        enEjecucion = false;
        if (textoEstado) textoEstado.textContent = '¡Bloque completado!';
        alert('¡Felicidades! Has completado tu bloque de concentración.');
      }
    }, 1000);
  }

  function pausarTemporizador() {
    clearInterval(temporizadorInterval);
    enEjecucion = false;

    if (btnTimerToggle) btnTimerToggle.textContent = 'Reanudar cronómetro';
    if (textoEstado) textoEstado.textContent = 'Pausa reflexiva · Detenido';
    if (puntoEstado && puntoEstado.parentElement) {
      puntoEstado.parentElement.classList.add('pausado');
    }
  }

  if (relojElemento && btnTimerToggle) {
    iniciarTemporizador();

    btnTimerToggle.addEventListener('click', function () {
      if (enEjecucion) {
        pausarTemporizador();
      } else {
        iniciarTemporizador();
      }
    });
  }

  // HU4: Contabilizar interrupciones menores sin detener el reloj
  if (btnDistraccion && displayDistracciones) {
    btnDistraccion.addEventListener('click', function () {
      contadorDistracciones++;
      displayDistracciones.textContent = contadorDistracciones;
    });
  }

  // Manejo de la Pausa Reflexiva (Modal)
  if (modalPausaDetails) {
    btnPausaReflexiva.addEventListener('click', function () {
      pausarTemporizador();
      const minsRestantes = Math.ceil(tiempoTotalSegundos / 60);
      if (tiempoRestanteModal) {
        tiempoRestanteModal.textContent = `${minsRestantes} minuto${minsRestantes !== 1 ? 's' : ''}`;
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

});