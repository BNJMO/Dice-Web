const buildCurrencyMap = (modules) =>
  Object.entries(modules).reduce((acc, [path, asset]) => {
    const variation = path.split("/").slice(-2, -1)[0];
    acc[variation] = asset;
    return acc;
  }, {});

const bitcoinModules = import.meta.glob(
  "../assets/sprites/currency/*/bitcoin.svg",
  { eager: true, import: "default" }
);
const dollarModules = import.meta.glob(
  "../assets/sprites/currency/*/dollar.svg",
  { eager: true, import: "default" }
);
const euroModules = import.meta.glob("../assets/sprites/currency/*/euro.svg", {
  eager: true,
  import: "default",
});

export const bitcoinMap = buildCurrencyMap(bitcoinModules);
export const dollarMap = buildCurrencyMap(dollarModules);
export const euroMap = buildCurrencyMap(euroModules);

export const getBitcoinAsset = (variation) => bitcoinMap[variation];
export const getDollarAsset = (variation) => dollarMap[variation];
export const getEuroAsset = (variation) => euroMap[variation];
