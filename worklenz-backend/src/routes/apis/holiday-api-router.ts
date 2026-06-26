import express from "express";
import HolidayController from "../../controllers/holiday-controller";
import safeControllerFunction from "../../shared/safe-controller-function";
import teamOwnerOrAdminValidator from "../../middlewares/validators/team-owner-or-admin-validator";
import idParamValidator from "../../middlewares/validators/id-param-validator";

const holidayApiRouter = express.Router();

// Holiday types
holidayApiRouter.get("/types", safeControllerFunction(HolidayController.getHolidayTypes));

// Organization holidays
holidayApiRouter.get("/organization", teamOwnerOrAdminValidator, safeControllerFunction(HolidayController.getOrganizationHolidays));
holidayApiRouter.post("/organization", teamOwnerOrAdminValidator, safeControllerFunction(HolidayController.createOrganizationHoliday));
holidayApiRouter.put("/organization/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(HolidayController.updateOrganizationHoliday));
holidayApiRouter.delete("/organization/:id", teamOwnerOrAdminValidator, idParamValidator, safeControllerFunction(HolidayController.deleteOrganizationHoliday));

// Country holidays
holidayApiRouter.get("/countries", safeControllerFunction(HolidayController.getAvailableCountries));
holidayApiRouter.get("/countries/:country_code", safeControllerFunction(HolidayController.getCountryHolidays));
holidayApiRouter.post("/import", teamOwnerOrAdminValidator, safeControllerFunction(HolidayController.importCountryHolidays));

// Calendar view
holidayApiRouter.get("/calendar", teamOwnerOrAdminValidator, safeControllerFunction(HolidayController.getHolidayCalendar));

// Populate holidays
holidayApiRouter.post("/populate", teamOwnerOrAdminValidator, safeControllerFunction(HolidayController.populateCountryHolidays));

export default holidayApiRouter; 