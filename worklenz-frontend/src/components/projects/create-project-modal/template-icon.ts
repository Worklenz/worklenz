/** Returns an emoji icon for a template name, used as fallback when image_url is absent. */
export const getTemplateIcon = (name?: string): string => {
  if (!name) return '📁';
  const n = name.toLowerCase();
  if (n.includes('bug') || n.includes('qa') || n.includes('test')) return '🐛';
  if (n.includes('sprint') || n.includes('scrum') || n.includes('agile')) return '🏃';
  if (n.includes('software') || n.includes('development') || n.includes('dev')) return '💻';
  if (n.includes('marketing') || n.includes('campaign')) return '📢';
  if (n.includes('construction') || n.includes('building')) return '🏗️';
  if (n.includes('startup') || n.includes('launch') || n.includes('release')) return '🚀';
  if (n.includes('design') || n.includes('creative')) return '🎨';
  if (n.includes('education') || n.includes('learning')) return '📚';
  if (n.includes('event') || n.includes('planning')) return '📅';
  if (n.includes('retail') || n.includes('sales')) return '🛍️';
  if (n.includes('finance') || n.includes('budget')) return '💰';
  if (n.includes('hr') || n.includes('human') || n.includes('recruit')) return '👥';
  if (n.includes('health') || n.includes('medical')) return '🏥';
  if (n.includes('research')) return '🔬';
  if (n.includes('roadmap') || n.includes('product')) return '🗺️';
  if (n.includes('legal')) return '⚖️';
  if (n.includes('nonprofit') || n.includes('ngo')) return '🤝';
  if (n.includes('manufacturing')) return '🏭';
  if (n.includes('information') || n.includes('it ')) return '🖥️';
  return '📁';
};
