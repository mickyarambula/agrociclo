-- Corrige 3 preguntas frecuentes sembradas con texto viejo (ya en producción):
-- mencionaban "Continuar con Google", la pantalla "Captura" (ahora "Hoy") y
-- números de una demo vieja. sembrar_faq_si_vacio() solo siembra si la tabla
-- está vacía, así que estos UPDATE corrigen lo que ya quedó insertado.
update plataforma_faq
   set pregunta = '¿Cómo entra mi Encargado o la oficina?',
       respuesta = 'En Ajustes copias el código del predio. Cuando esa persona entra a AgroCiclo (con su celular o su correo) y todavía no tiene predio, la pantalla “¿Cómo entras?” le pregunta si tiene un código o si va a dar de alta el suyo — ahí escribe el que le diste. Tú le das rol: Oficina, Encargado de campo o Consulta.',
       actualizado_en = now()
 where pregunta = '¿Cómo entra mi Encargado o la oficina?'
   and respuesta like '%Continuar con Google%';

update plataforma_faq
   set respuesta = 'Hoy → Labor, Raya, Boleta o Solicitud. Un toque. La oficina pone precio y flete después.',
       actualizado_en = now()
 where pregunta = '¿Dónde anoto lo que pasó en el lote?'
   and respuesta like 'Captura →%';

update plataforma_faq
   set pregunta = 'Los números que veo al entrar, ¿son de mi predio?',
       respuesta = 'No. Si ves cifras que no reconoces, son de la demo de prueba. Tu ciclo de siembra arranca vacío: el almacén se llena con tu primera compra y la bodega baja con tu primera labor.',
       actualizado_en = now()
 where pregunta = 'Los 2,150 L de diésel, ¿son de mi predio?';
