// keep-alive.js - Sistema automático para mantener activo el proyecto de Supabase
// Realiza consultas cada 5 días evitando martes y miércoles

(async function keepAlive() {
    try {
        // Verificar que supabase esté disponible
        if (typeof supabase === 'undefined') {
            console.log('⏸️ Keep-Alive: Supabase no disponible en esta página');
            return;
        }

        const STORAGE_KEY = 'supabase_last_keepalive';
        const DAYS_INTERVAL = 5;
        const EXCLUDED_DAYS = [2, 3]; // Martes = 2, Miércoles = 3

        // Obtener última fecha de consulta
        const lastCheck = localStorage.getItem(STORAGE_KEY);
        const now = new Date();
        const currentDay = now.getDay(); // 0=Domingo, 1=Lunes, 2=Martes, ..., 6=Sábado

        // Si es martes o miércoles, no hacer nada
        if (EXCLUDED_DAYS.includes(currentDay)) {
            console.log('⏸️ Keep-Alive: Hoy es martes o miércoles, consulta postponed');
            return;
        }

        let shouldExecute = false;

        if (!lastCheck) {
            // Primera vez, ejecutar la consulta
            shouldExecute = true;
            console.log('🔄 Keep-Alive: Primera ejecución');
        } else {
            // Calcular días transcurridos
            const lastCheckDate = new Date(lastCheck);
            const diffTime = Math.abs(now - lastCheckDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= DAYS_INTERVAL) {
                shouldExecute = true;
                console.log(`🔄 Keep-Alive: Han pasado ${diffDays} días desde la última consulta`);
            } else {
                console.log(`✅ Keep-Alive: Proyecto activo (última consulta hace ${diffDays} días)`);
            }
        }

        if (shouldExecute) {
            // Realizar consulta silenciosa para mantener activo el proyecto
            const { data, error } = await supabase
                .from('alumnos')
                .select('id')
                .limit(1);

            if (error) {
                console.error('❌ Keep-Alive: Error en consulta:', error.message);
            } else {
                // Guardar la fecha actual en localStorage
                localStorage.setItem(STORAGE_KEY, now.toISOString());
                console.log('✅ Keep-Alive: Consulta exitosa - Proyecto mantenido activo');
            }
        }
    } catch (error) {
        console.error('❌ Keep-Alive: Error general:', error);
    }
})();
