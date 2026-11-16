/** Select one bounded classroom path without mutating the reusable module. */
export function selectClassRoute(config, routeId) {
  if (!routeId) return config;
  const route = config.classRoutes?.[routeId];
  if (!route) throw new Error(`Unknown class activity: ${routeId}. Open the exact link in Google Classroom.`);
  if (!Array.isArray(route.sections) || !route.sections.length) throw new Error(`Empty class activity: ${routeId}`);
  const sections = route.sections.map(id => {
    const section = config.sections.find(section => section.id === id);
    if (!section) throw new Error(`Class activity ${routeId} is missing section ${id}`);
    return section;
  });
  return { ...config, sections, assignedRoute: route, storageKey: `${config.storageKey}:class:${routeId}` };
}
