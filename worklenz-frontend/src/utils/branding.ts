export const getBrandName = () => {
    return import.meta.env.VITE_APP_BRAND_NAME || 'Projetos';
};
