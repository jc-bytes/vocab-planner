# Sistema de Evaluación Sensorial de Café

Sería una aplicación web para administrar el proceso de evaluación sensorial del café, permitiendo organizar sesiones de catación, registrar evaluaciones, generar reportes y mantener la trazabilidad de la información.

## Flujo del sistema

Crear sesión → Invitar catadores → Realizar evaluaciones → Generar estadísticas → Generar reportes

## Funcionalidades que proponemos

### Gestión de usuarios

- Administración de usuarios y permisos.
- Invitación de nuevos participantes mediante correo electrónico.
- Roles según el tipo de usuario.
- Invitación con código de sesión.

### Dashboard

- Resumen de las sesiones activas.
- Indicadores principales.
- Acceso rápido a las funciones más utilizadas.
- Últimas evaluaciones realizadas.

### Gestión de sesiones

- Creación de sesiones de catación.
- Asignación de uno o varios cafés.
- Asignación de uno o varios lotes.
- Asignación de catadores.
- Sesiones públicas, ciegas y doble ciegas.
- Plantillas reutilizables para diferentes tipos de evaluación.
- Cierre manual o automático.
- Cierre automático cuando todos los participantes hayan completado la evaluación.

### Gestión de Variables

- Nombre de la variable.
- Orden de visualización.
- Peso de la variable.
- Rango de puntuación.
- Campo requerido u opcional.
- Grupo de descriptores asociado.

Formularios de evaluación

- Variables configurables.
- Peso por variable.
- Comentarios generales y por atributo.
- Descriptores configurables.
- Reutilización de formularios para futuras sesiones.

### Evaluación

- Registro de puntajes.
- Comentarios.
- Tipicidad.
- Selección de descriptores.
- Estadísticas automáticas.

### Generación de reportes

- Reportes por sesión.
- Reportes por café.
- Reportes por catador.
- Comparación de evaluaciones.
- Estadísticas generales.
- Exportación a PDF, Excel y CSV.

### Funcionamiento sin conexión

- Registro de información sin Internet.
- Almacenamiento temporal de la información.
- Sincronización automática cuando la conexión sea restablecida.
- Indicador del estado de sincronización.

### Protección de la información

- Prevención de evaluaciones duplicadas.
- Protección contra envíos repetidos durante la sincronización.
- Validación de la información antes de almacenarla.

### Modos

- Open: Coffee identity visible.
- Blind: Hidden from evaluators.
- Double Blind: Hidden from evaluators and organizers.

### Gestión de la información

- Historial de evaluaciones.
- Consulta de sesiones anteriores.
- Trazabilidad entre evaluación, café y lote.
- Búsqueda de información histórica.

### Configuración

- Escalas de evaluación.
- Parámetros del sistema.
- Configuración de organizaciones.


Sistema de Registro de Cosecha de Café

## Descripción

Sería una aplicación web para registrar el proceso de recepción de café cosechado, asociando cada entrega con el trabajador, la parcela, el lote y el tipo de café correspondiente, permitiendo mantener la trazabilidad de la información y generar reportes operativos en tiempo real.

## Flujo general

Iniciar jornada → Seleccionar tipo de café y lote → Registrar peso → Identificar trabajador → Confirmar información → Guardar registro → Siguiente trabajador

## Funcionalidades que proponemos

### Gestión de trabajadores

- Administración de trabajadores.
- Registro de información personal.
- Identificación mediante reconocimiento facial.
- Gestión de usuarios y permisos.

### Dashboard

- Resumen de la jornada.
- Total recolectado.
- Entregas registradas.
- Trabajadores activos.

### Configuración de la jornada

- Selección del tipo de café.
- Selección de lote.
- Selección de parcela o parcelas (para momentos en los que utilizan varias).
- Configuración inicial de la jornada de trabajo.

### Registro de cosecha

- Captura manual del peso en el prototipo y automática con básculas digitales en una etapa posterior.
- Asociación del registro con el trabajador identificado.
- Registro de variedad, proceso y clasificación del café.
- Registro de fecha y hora de cada entrega.
- Conversión del peso a cantidad de latas (configurable).
- Confirmación de la información antes de guardar.
- Pantalla de resumen con la información del trabajador y la entrega antes de confirmar el registro.
### Gestión de la información

- Historial de entregas por trabajador.
- Consulta de registros por día.
- Trazabilidad entre trabajador, lote, parcela y tipo de café.
- Búsqueda y consulta de registros históricos.

### Generación de reportes

- Reporte diario de cosecha.
- Reporte por trabajador.
- Reporte por lote.
- Reporte por parcela.
- Reporte por variedad.
- Productividad por hora.
- Resumen de entregas.
- Desglose por clasificación del café (1ra, 2da y 3ra).
- Información para el cálculo de pagos.

### Gestión de lotes y parcelas

- Registro de lotes.
- Registro de parcelas.
- Asociación entre parcelas y lotes.
- Estado de disponibilidad.

### Configuración

- Administración de tipos de café.
- Administración de variedades.
- Administración de procesos.
- Administración de clasificaciones.
- Configuración del precio por lata.

### Funcionamiento sin conexión

- Registro de información sin acceso a Internet.
- Almacenamiento local temporal.
- Sincronización automática cuando la conexión sea restablecida.
- Indicador del estado de sincronización.
- Protección contra pérdida de información.

### Protección de la información

- Prevención de registros de cosecha duplicados.
- Protección contra registros repetidos por fallas de conexión o reintentos.
- Validación de la información antes de almacenarla.

### Gestión de pagos

- Información para cálculo de pagos.
- Generación de tabla de pagos

# Servicio mensual de administración de la plataforma

El servicio mensual permitirá mantener la plataforma operativa, segura y actualizada.

- Hospedaje de la plataforma.
- Administración de la base de datos.
- Respaldos automáticos.
- Monitoreo de disponibilidad.
- Actualizaciones de seguridad.
- Soporte técnico.
- Corrección de errores.
- Monitoreo del almacenamiento y rendimiento.
- Mantenimiento preventivo.
