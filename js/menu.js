/**
 * menu.js - Adaptación del Menú Responsive de ACME para PomoPlan
 * 
 * Funcionalidad:
 * 1. Control del menú hamburguesa en pantallas móviles (<= 600px).
 * 2. Gestión de atributos de accesibilidad ARIA (aria-expanded, aria-label, hidden).
 * 3. Cierre automático del menú al hacer clic en un enlace, el botón de modo nocturno (HU6) o presionar Escape.
 * 4. Ajuste de estado durante el cambio de tamaño de pantalla (resize/matchMedia).
 */

document.addEventListener('DOMContentLoaded', function () {
  // PASO 1. Selección de elementos del DOM
  const botonMenu = document.querySelector('#boton-menu');
  const navegacion = document.querySelector('#navegacion');
  const textoMenu = document.querySelector('#texto-menu');
  const submenu = document.querySelector('#resolver');
  const marcaLogo = document.querySelector('.marca');
  const btnModoNocturno = document.querySelector('#toggle-modo-nocturno');

  if (!botonMenu || !navegacion) return;

  // PASO 2. Media Query para pantallas móviles (coincide con CSS @media max-width: 600px)
  const pantallaMovil = window.matchMedia('(max-width: 600px)');

  // PASO 3. Función principal para cambiar estado del menú
  function cambiarMenu(abrir) {
    // En escritorio, la navegación siempre está visible. En móvil, depende de 'abrir'.
    navegacion.hidden = pantallaMovil.matches && !abrir;
    botonMenu.setAttribute('aria-expanded', String(abrir));
    botonMenu.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
    if (textoMenu) {
      textoMenu.textContent = abrir ? 'Cerrar' : 'Menú';
    }

    // Si se cierra el menú principal, se cierra también el submenú desplegable
    if (!abrir && submenu) {
      submenu.open = false;
    }
  }

  // PASO 4. Evento Click en el botón hamburguesa
  botonMenu.addEventListener('click', function () {
    const estaAbierto = botonMenu.getAttribute('aria-expanded') === 'true';
    cambiarMenu(!estaAbierto);
  });

  // PASO 5. Delegación de eventos para cerrar menú al hacer clic en cualquier enlace
  navegacion.addEventListener('click', function (evento) {
    const enlace = evento.target.closest('a');
    if (!enlace) return;

    cambiarMenu(false);

    // Desplazamiento y foco accesible al destino
    const ruta = enlace.getAttribute('href');
    if (ruta && ruta.includes('#')) {
      const idDestino = ruta.substring(ruta.indexOf('#'));
      const destino = document.querySelector(idDestino);
      if (destino) {
        destino.focus({ preventScroll: true });
      }
    }
  });

  // Clic en la marca/logo vuelve al inicio y cierra el menú
  if (marcaLogo) {
    marcaLogo.addEventListener('click', function () {
      cambiarMenu(false);
      const inicio = document.querySelector('#inicio');
      if (inicio) inicio.focus({ preventScroll: true });
    });
  }

  // Cierre del menú desplegable móvil al interactuar con el botón de Modo Nocturno (HU6)
  if (btnModoNocturno) {
    btnModoNocturno.addEventListener('click', function () {
      if (pantallaMovil.matches) {
        cambiarMenu(false);
      }
    });
  }

  // PASO 6. Evento Keydown para cerrar con la tecla Escape
  document.addEventListener('keydown', function (evento) {
    if (evento.key !== 'Escape') return;

    if (pantallaMovil.matches && !navegacion.hidden) {
      cambiarMenu(false);
      botonMenu.focus();
    } else if (submenu && submenu.open) {
      submenu.open = false;
      const summary = submenu.querySelector('summary');
      if (summary) summary.focus();
    }
  });

  // PASO 7. Reajuste adaptativo al cambiar el tamaño de ventana
  function ajustarPantalla() {
    const focoEnNavegacion = navegacion.contains(document.activeElement);
    const focoEnBoton = document.activeElement === botonMenu;
    cambiarMenu(false);

    if (pantallaMovil.matches && focoEnNavegacion) {
      botonMenu.focus();
    } else if (!pantallaMovil.matches && focoEnBoton) {
      const primerEnlace = navegacion.querySelector('a');
      if (primerEnlace) primerEnlace.focus();
    }
  }

  // Escuchar cambios de resolución
  pantallaMovil.addEventListener('change', ajustarPantalla);

  // Estado inicial al cargar
  ajustarPantalla();
});