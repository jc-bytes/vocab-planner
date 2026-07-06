# Propuestas de Desarrollo
## Sistema de Evaluación Sensorial de Café

Seria una aplicación web para administrar el proceso de evaluación sensorial del café, permitiendo organizar sesiones de catación, registrar evaluaciones, generar reportes y mantener la trazabilidad de la información.
## Flujo del sistema
Crear sesión → Invitar catadores → Realizar evaluaciones → Generar estadísticas
## Funcionalidades que proponemos

### Gestión de usuarios
- Administración de usuarios y permisos.
- Invitación de nuevos participantes mediante correo electrónico.
- Roles según el tipo de usuario.
### Gestión de sesiones
- Creación de sesiones de catación.
- Asignación de cafés y catadores.
- Sesiones públicas, ciegas y doble ciegas.
- Cierre manual o automático.
### Formularios de evaluación
- Variables configurables.
- Peso por variable.
- Comentarios generales y por atributo.
- Descriptores configurables.
### Evaluación
- Registro de puntajes.
- Comentarios.
- Tipicidad.
- Estadísticas automáticas.
### Reportes
- Reportes por sesión.
- Reportes por café.
- Reportes por catador.
- Exportación a PDF, Excel y CSV.
### Funcionamiento sin conexión

- Registro de información sin Internet.
- Sincronización automática cuando la conexión sea restablecida.
### Modos
- Open: Coffee identity visible               
- Blind: Hidden from evaluators                
- Double Blind: Hidden from evaluators and organizers 


## Sistema de Registro de Cosecha de Café

## Descripción
Seria una aplicación web para registrar el proceso de recepción de café cosechado, asociando cada entrega con el trabajador, la parcela, el lote y el tipo de café correspondiente, permitiendo mantener la trazabilidad de la información y generar reportes operativos en tiempo real.

## Flujo general

**Iniciar jornada** → **Seleccionar tipo de café y lote** → **Registrar peso** → **Identificar trabajador** → **Confirmar información** → **Guardar registro** → **Siguiente trabajador**
## Funcionalidades que proponemos

### Gestión de trabajadores
- Administración de trabajadores.
- Registro de información personal.
- Identificación mediante reconocimiento facial.
- Gestión de usuarios y permisos.

### Configuración de la jornada
- Selección del tipo de café.
- Selección de lote.
- Selección de parcela o parcelas.
- Configuración inicial de la jornada de trabajo.

### Registro de cosecha

- Captura manual del peso en prototipo y automatico para el final.
- Asociación del registro con el trabajador identificado.
- Registro de variedad, proceso y clasificación del café.
- Registro de fecha y hora de cada entrega.
- Confirmación de la información antes de guardar.

### Gestión de la información

- Historial de entregas por trabajador.
- Consulta de registros por día.
- Trazabilidad entre trabajador, lote, parcela y tipo de café.
- Búsqueda y consulta de registros históricos.

### Reportes

- Reporte diario de cosecha.
- Reporte por trabajador.
- Reporte por lote.
- Reporte por parcela.
- Reporte por variedad.
- Productividad por hora.
- Resumen de entregas.
- Desglose por clasificación del café (primera, segunda, tercera y café verde seleccionado).

### Funcionamiento sin conexión

- Registro de información sin acceso a Internet.
- Almacenamiento local temporal.
- Sincronización automática cuando la conexión sea restablecida.
- Indicador del estado de sincronización.
