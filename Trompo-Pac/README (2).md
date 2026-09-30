# 🤖 Trompobot: Laberinto de Ciencia

> Un juego tipo Pac-Man con chispas de ciencia, creado para **el trompo · Museo Interactivo Tijuana**.

![Trompobot](https://img.shields.io/badge/HTML5-Canvas-orange?style=flat-square)
![Mobile](https://img.shields.io/badge/Móvil-Listo-brightgreen?style=flat-square)
![Idioma](https://img.shields.io/badge/Español-100%25-blue?style=flat-square)

---

## ¿De qué se trata?

**Trompobot** es un laberinto de ciencia donde controlas a un robot-trompo que recoge **chispas de colores**.  
Cuidado con los **triángulos garabato**: si te atrapan, pierdes una vida.  
Con una **chispa de ciencia ✷** los dejas mareados y puedes comértelos para sumar puntos extra.

Aprende jugando, gira el laberinto y supera tu récord.

---

## 🎮 Cómo jugar

| Control | Acción |
|---------|--------|
| **Flechas** o **WASD** | Mover a Trompobot |
| **Shift** | **Dash** (velocidad extra + invulnerabilidad breve) |
| **P** | Pausar / Continuar |
| **Botones en pantalla** | Controles táctiles (móvil) |
| **Deslizar el dedo** | Mover (recomendado en horizontal) |

### Objetivo
- Recoge **todas las chispas** del laberinto para pasar de nivel.
- Evita a los triángulos o come una chispa de ciencia para asustarlos.
- El **dash** se recarga con puntos (cuesta 350 pts). Úsalo para escapar o alcanzar más lejos.
- Tienes **3 vidas**. Cuando se acaban… ¡a intentar de nuevo!

### Extras
- Tabla de **TOP 5** récords (se guarda en el navegador).
- Niveles cada vez más rápidos y desafiantes.
- Diseño pensado para niños y para pantallas táctiles.

---

## 🚀 Cómo ejecutarlo

No necesita servidor ni instalación de dependencias. Solo abre el archivo:

```bash
# Clona o descarga el proyecto y abre:
open index.html
# o haz doble clic en index.html
```

También puedes servirlo localmente si lo prefieres:

```bash
# Con Python
python -m http.server 8000

# Con Node (npx)
npx serve .
```

Luego visita `http://localhost:8000`.

---

## 📁 Estructura del proyecto

```
Trompo-Pac/
├── index.html   # Página principal + UI (HUD, overlays, leaderboard)
├── style.css    # Estilos coloridos y responsive
├── game.js      # Lógica completa del juego (canvas, IA, dash, niveles…)
└── README.md    # Este archivo
```

---

## ✨ Características técnicas

- **Canvas 2D** puro (sin frameworks)
- Mapa simétrico inspirado en Pac-Man clásico
- Modos **scatter / chase** con cronograma por nivel
- Velocidades escalonadas (tutorial → fácil → normal → difícil)
- Sistema de **dash** con recarga por puntos e invulnerabilidad
- Controles de teclado + botones táctiles + swipe
- Leaderboard local (localStorage) con filtro de nombres
- Responsive y friendly con safe-area (móviles)

---

## 🎨 Créditos

Desarrollado para **el trompo · Museo Interactivo Tijuana**  
Tema: ciencia, juego y diversión.

---

## 📜 Licencia

Uso libre para fines educativos y de museo.  
Si lo modificas o lo usas en otro contexto, ¡dale crédito al proyecto original!

---

**¡Imagínate, aprendiendo jugando!** ⚡🔬
