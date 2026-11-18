describe("database add-on session configuration", () => {
  const oldEnabled = process.env.ENABLED_ADDONS;
  const oldOptions = process.env.PGOPTIONS;

  afterEach(() => {
    if (oldEnabled === undefined) delete process.env.ENABLED_ADDONS;
    else process.env.ENABLED_ADDONS = oldEnabled;
    if (oldOptions === undefined) delete process.env.PGOPTIONS;
    else process.env.PGOPTIONS = oldOptions;
    jest.resetModules();
  });

  it("passes enabled IDs to PostgreSQL without allowing option injection", () => {
    process.env.ENABLED_ADDONS = "integration-factory, another-addon,evil -c statement_timeout=0";
    process.env.PGOPTIONS = "-c statement_timeout=1000";
    const config = require("./db-config").default;
    expect(config.options).toBe("-c statement_timeout=1000 -c worklenz.enabled_addons=integration-factory,another-addon");
  });

  it("passes an empty setting when no add-ons are enabled", () => {
    delete process.env.ENABLED_ADDONS;
    delete process.env.PGOPTIONS;
    const config = require("./db-config").default;
    expect(config.options).toBe("-c worklenz.enabled_addons=");
  });
});
