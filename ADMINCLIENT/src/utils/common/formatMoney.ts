export const formatMoney = (value: string | number) => {
    const num = Number(value ?? 0);
    return num.toFixed(2);
};