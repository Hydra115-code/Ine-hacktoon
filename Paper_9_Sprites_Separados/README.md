# Paper — Kit de 9 sprites PNG separados

Extraidos de la imagen 3×3 compartida por el equipo. Los nueve archivos estan en `sprites/`.

## Montaje sugerido (de atras hacia adelante)
1. `paper_back.png`
2. `paper_front.png`
3. `sunglasses.png`
4. `hand_left_idle.png` y `hand_right_idle.png`

Puedes cambiar una mano por `hand_point_right.png`, `hand_wave.png`, `hand_present.png` o `hand_thumbs_up.png`.

## Uso
Copia `sprites/` a `public/paper/` de Next.js y usa `<img src="/paper/sunglasses.png" />` o `next/image`.
Usa `position: absolute` dentro del personaje y anima las capas con Motion.
Para mover a Paper entre elementos de UI, coloca el conjunto en un contenedor `position: fixed`.

## Importante
- **Estas son piezas sueltas, no animaciones.** Se deben montar y animar en React.
- Hemos eliminado automaticamente el fondo gris, creando canal alfa. Pueden quedar halos en bordes sobre fondos muy oscuros. Revisa antes de usar en produccion.
- No se garantizan proporciones 100% identicas a la imagen original; corresponden a lo que Nano Banana genero.
- Para apuntar hacia la izquierda, puedes reflejar `hand_point_right.png` horizontalmente con CSS `scaleX(-1)`.
