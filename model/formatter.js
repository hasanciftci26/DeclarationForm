sap.ui.define([], function() {
	"use strict";

	return {
		/**
		 * Rounds the currency value to 2 digits
		 *
		 * @public
		 * @param {string} sValue value to be formatted
		 * @returns {string} formatted currency value with 2 digits
		 */
		currencyValue: function(sValue) {
			if (!sValue) {
				return "";
			}

			return parseFloat(sValue).toFixed(2);
		},
		statusText: function(sValue) { //Formatter change view branch
			var vStatus = "";
			switch (sValue) {
				case "INIT":
					vStatus = "None";
					break;
				case "SENT":
					vStatus = "Warning";
					break;
				case "APPR":
					vStatus = "Success";
					break;
				case "REJC":
					vStatus = "Error";
					break;
				case "REVS":
					vStatus = "None";
					break;
				case "ACRJ":
					vStatus = "None";
					break;
				default:
					vStatus = "None";
					break;
			}
			return vStatus;
		},
		downloadLinkFormatter: function(DocumentId) {
			return this.getModel().sServiceUrl + "/AttachmentSet('" + DocumentId + "')/$value";
		},
		formatApproveState: function(sStatus) {
			switch (sStatus) {
				case "A":
				case "O":
					return "Success";
				case "R":
				case "E":
					return "Error";
				case "C":
				case "S":
				case "V":
					return "Warning";
				default:
					return "None";
			}
		}
	};

});