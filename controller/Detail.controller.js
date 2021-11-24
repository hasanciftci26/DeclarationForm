/*global location */
sap.ui.define([
	"sunexpress/declarationform/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sunexpress/declarationform/model/formatter",
	"sap/m/MessageToast",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/UploadCollectionParameter",
	"sap/m/MessageBox"
], function(BaseController, JSONModel, formatter, MessageToast, Filter, FilterOperator, UploadCollectionParameter, MessageBox) {
	"use strict";

	return BaseController.extend("sunexpress.declarationform.controller.Detail", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function() {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0
			});

			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

			this.setModel(oViewModel, "detailView");

			this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Event handler when the share by E-Mail button has been clicked
		 * @public
		 */
		onShareEmailPress: function() {
			var oViewModel = this.getModel("detailView");

			sap.m.URLHelper.triggerEmail(
				null,
				oViewModel.getProperty("/shareSendEmailSubject"),
				oViewModel.getProperty("/shareSendEmailMessage")
			);
		},

		/**
		 * Event handler when the share in JAM button has been clicked
		 * @public
		 */
		onShareInJamPress: function() {
			var oViewModel = this.getModel("detailView"),
				oShareDialog = sap.ui.getCore().createComponent({
					name: "sap.collaboration.components.fiori.sharing.dialog",
					settings: {
						object: {
							id: location.href,
							share: oViewModel.getProperty("/shareOnJamTitle")
						}
					}
				});

			oShareDialog.open();
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function(oEvent) {
			var sObjectId = oEvent.getParameter("arguments").objectId;
			this.getModel().metadataLoaded().then(function() {
				// if (sObjectId === undefined) {
				var sVisible = {
					Visible: false
				};
				var oVisibleModel = new JSONModel(sVisible);
				this.getView().setModel(oVisibleModel, "EditVisible");
				// }
				var sEnabled = {
					Enabled: (sObjectId === undefined)
				};
				var oEnabledModel = new JSONModel(sEnabled);
				this.getView().setModel(oEnabledModel, "EnabledValue");
				if (sObjectId !== undefined) {
					this._vReqnr = sObjectId;
					var sObjectPath = this.getModel().createKey("RequestListSet", {
						Reqnr: sObjectId
					});
					this._bindView("/" + sObjectPath);
				} else {
					var oData = {};
					this.getView().byId("objectHeader").setTitle("");
					var oJsonModel = new JSONModel(oData);
					this.getView().setModel(oJsonModel, "Declaration");
					var oViewModel = this.getModel("detailView");
					oViewModel.setProperty("/busy", false);
					if (this.getView().getModel("AttachmentsModel") !== undefined) {
						this.getView().getModel("AttachmentsModel").setData([]);
						this.getView().getModel("AttachmentsModel").refresh();
						this.getView().byId("uploadCollection").removeAllItems();
					}
				}
			}.bind(this));
		},

		/**
		 * Binds the view to the object path. Makes sure that detail view displays
		 * a busy indicator while data for the corresponding element binding is loaded.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound to the view.
		 * @private
		 */
		_bindView: function(sObjectPath) {
			// Set busy indicator during view binding
			var oViewModel = this.getModel("detailView");

			// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
			oViewModel.setProperty("/busy", false);

			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function() {
						oViewModel.setProperty("/busy", true);
					},
					dataReceived: function() {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},

		_onBindingChange: function() {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("detailObjectNotFound");
				// if object could not be found, the selection in the master list
				// does not make sense anymore.
				this.getOwnerComponent().oListSelector.clearMasterListSelection();
				return;
			}

			var sPath = oElementBinding.getPath();
			this.getOwnerComponent().oListSelector.selectAListItem(sPath);
			var that = this;
			var oBindingContext = this.getView().getBindingContext();
			//var sPath = "/MyRequestSet('" + sObjectId + "')";
			var oObject = oBindingContext.getModel().getProperty(sPath);
			//get questions to model
			this.getView().getModel().read("/RequestDetailSet('" + oObject.Reqnr + "')", {
				filters: null,
				sorters: null,
				async: true,
				success: function(oData) {
					oData.Period = oData.Period.substring(4, 6) + "/" + oData.Period.substring(0, 4);
					var oJsonModel = new JSONModel(oData);
					that.getView().setModel(oJsonModel, "Declaration");
					that.getView().byId("cbCountries").setSelectedKey(oData.Country);
					if (oData.ReqStat === "REVS") {
						that.getView().getModel("EditVisible").setProperty("/Visible", true);
					} else {
						that.getView().getModel("EditVisible").setProperty("/Visible", false);
					}
				},
				error: function(oError) {

				}
			});

			// get approvers to model
			var approverFilter = [];
			approverFilter.push(new Filter("Reqnr", FilterOperator.EQ, oObject.Reqnr));
			that.getView().getModel().read("/ApproversSet", {
				filters: approverFilter,
				sorters: null,
				async: true,
				success: function(oData) {
					var oJsonModel = new JSONModel(oData.results);
					that.getView().setModel(oJsonModel, "ApproversModel");
				}
			});
			//Attachment
			var attachmentFilter = [];
			attachmentFilter.push(new Filter("Reqnr", FilterOperator.EQ, oObject.Reqnr));

			this.getView().getModel().read("/AttachmentSet", {
				filters: attachmentFilter,
				sorters: null,
				async: true,
				success: function(oData) {
					var oJsonModel = new JSONModel(oData.results);
					that.getView().setModel(oJsonModel, "AttachmentsModel");

					var oViewModel = that.getModel("detailView");
					oViewModel.setProperty("/busy", false);
					// that.selectFirstItem();
				},
				error: function(oError) {
					var oViewModel = that.getModel("detailView");
					oViewModel.setProperty("/busy", false);
					// that.selectFirstItem();
				}
			});
		},
		onRevisePress: function() {
			this.getView().getModel("EnabledValue").setProperty("/Enabled", true);
			this.getView().byId("objectHeader").setVisible(true);
			this.getView().byId("objectHeader").setTitle(this._vReqnr);
		},
		//upload collection Area
		onStartUpload: function(oEvent) {
			this.vNewFile = 0;
			var oUploadCollection = this.getView().byId("uploadCollection");
			var oItems = oUploadCollection.getItems();
			var cFiles = oItems.length;
			if (cFiles !== 0) {
				for (var i = 0; i < cFiles; i++) {
					if (oItems[i].getProperty("documentId") === "") {
						this.vNewFile = this.vNewFile + 1;
					}
				}
				if (this.vNewFile === 0) {
					// this.firstRowSelect(this.getView().getModel("valuesModel").getData().Reqnr);
					var oViewModel = this.getModel("detailView");
					oViewModel.setProperty("/busy", false);
				}
				oUploadCollection.upload();
			} else {
				// this.firstRowSelect(this.getView().getModel("valuesModel").getData().Reqnr);
				oViewModel = this.getModel("detailView");
				oViewModel.setProperty("/busy", false);
			}
		},
		onBeforeUploadStarts: function(oEvent) {
			var that = this;
			var sFilename = oEvent.getParameter("fileName");
			var sContentDisposition = "";
			sContentDisposition = (sFilename + "#" + this.vReqnr);
			var oCustomerHeaderSlug = new sap.m.UploadCollectionParameter({
				name: "Content-Disposition",
				value: sContentDisposition
			});
			var count = sFilename.length;

			if (sFilename.substring(count - 3) === "rar" || sFilename.substring(count - 3) === "zip") {
				var oCustomerHeaderType = new sap.m.UploadCollectionParameter({
					name: "Content-Type",
					value: "application/x-zip-compressed"
				});
				oEvent.getParameters().addHeaderParameter(oCustomerHeaderType);
			}
			var oCustomerHeaderToken = new UploadCollectionParameter({
				name: "x-csrf-token",
				value: this.getView().getModel().getSecurityToken()
			});
			oEvent.getParameters().addHeaderParameter(oCustomerHeaderSlug);
			oEvent.getParameters().addHeaderParameter(oCustomerHeaderToken);
			this.counter++;
			setTimeout(function() {
				MessageToast.show(that.getView().getModel("i18n").getResourceBundle().getText("worklistCreateFileSuccess"));
			}, 500);
		},
		onUploadCompleteCollection: function(oEvent) {
			var that = this;
			this.vNewFile = this.vNewFile - 1;
			if (this.vNewFile === 0) {
				//get attachments to model
				var attachmentFilter = [];
				attachmentFilter.push(new Filter("Reqnr", FilterOperator.EQ, this.vReqnr));
				that.getView().getModel().read("/AttachmentSet", {
					filters: attachmentFilter,
					sorters: null,
					async: true,
					success: function(oData) {
						var oJsonModel = new JSONModel(oData.results);
						that.getView().setModel(oJsonModel, "AttachmentsModel");

						var oViewModel = that.getModel("detailView");
						oViewModel.setProperty("/busy", false);
						// that.selectFirstItem();
					},
					error: function(oError) {
						var oViewModel = that.getModel("detailView");
						oViewModel.setProperty("/busy", false);
						// that.selectFirstItem();
					}
				});
			}

		},
		onSavePress: function() {
			var vVisible = this.getView().getModel("EditVisible").getData().Visible;
			var that = this;
			var oDeclarationModel = this.getView().getModel("Declaration");
			var sData = oDeclarationModel.getData();
			if (sData.Period === undefined || sData.RelatedAuth === undefined || sData.Detail === undefined ||
				sData.TotalAmount === undefined || sData.Waers === undefined || this.getView().byId("cbCountries").getSelectedKey() === "") {
				MessageBox.information("Please fill required fields");
				return;
			}
			if (sData.Period.indexOf("/") !== 2) {
				MessageBox.information("Period format must be mm/yyyy");
				return;
			}
			var regExp = /[a-zA-Z]/g;
			if (regExp.test(sData.Period)) {
				MessageBox.information("Period cannot contain any letter");
				return;
			}
			if (sData.TotalAmount.length > 10) {
				MessageBox.information("Allowed length for amount is 10");
				return;
			}

			var sEntry = {
				Reqnr: (vVisible === true) ? sData.Reqnr : "",
				ReqStatText: "",
				ReqStat: "",
				Country: this.getView().byId("cbCountries").getSelectedKey(),
				Period: sData.Period.substring(3, 7) + sData.Period.substring(0, 2),
				RelatedAuth: sData.RelatedAuth,
				Detail: sData.Detail,
				TotalAmount: sData.TotalAmount.toString(),
				Waers: sData.Waers
			};

			sap.ui.core.BusyIndicator.show();
			this.getView().getModel().create("/RequestDetailSet", sEntry, {
				success: function(oData) {
					if (oData.Reqnr !== "") {
						if (vVisible === true) {
							that.getView().getModel("EnabledValue").setProperty("/Enabled", false);
							that.getView().getModel("EditVisible").setProperty("/Visible", false);
						}
						sap.ui.core.BusyIndicator.hide();
						MessageBox.information(oData.Reqnr + " " + "form has been saved.");
						that.vReqnr = oData.Reqnr;
						that.onStartUpload();
						var oEventBus = new sap.ui.getCore().getEventBus();
						oEventBus.publish("Detail", "Refresh");
						that.getRouter().navTo("object", {
							objectId: oData.Reqnr
						}, true);

					} else {
						MessageToast.show("Kayıt edilemedi");
					}
				},
				error: function(oError) {
					sap.ui.core.BusyIndicator.hide();
				}
			});
		},
		onValueHelpRequested: function() {
			var that = this;
			sap.ui.core.BusyIndicator.show();
			this.getView().getModel().read("/F4ValueHelpSet", {
				filters: null,
				sorters: null,
				async: true,
				success: function(oData) {
					sap.ui.core.BusyIndicator.hide();
					var oF4HelpModel = new JSONModel(oData.results);
					that.sF4ValueHelp = oData.results;
					that.getView().setModel(oF4HelpModel, "F4ValueHelpModel");
					that._getValueHelpDialog(that).open();
				},
				error: function(oError) {
					sap.ui.core.BusyIndicator.hide();
				}
			});
		},
		_getValueHelpDialog: function(that) {
			that._oF4ValueHelpDialog = sap.ui.getCore().byId("tsdValueHelp");
			if (!that._oF4ValueHelpDialog) {
				that._oF4ValueHelpDialog = sap.ui.xmlfragment("sunexpress.declarationform.fragments.F4ValueHelp", that);
				that.getView().addDependent(that._oF4ValueHelpDialog);
				jQuery.sap.syncStyleClass("sapUiSizeCompact", that.getView(), that._oF4ValueHelpDialog);
			}
			return that._oF4ValueHelpDialog;
		},
		onF4ValueHelpSelected: function(oEvent) {
			var oSelectedValues = oEvent.getParameter("selectedContexts")[0].getProperty();
			this.getView().getModel("Declaration").setProperty("/Waers", oSelectedValues.Code);
		},
		onSearchF4ValueHelp: function(oEvent) {
			var sSearchValue = oEvent.getParameters().value.toUpperCase();
			var aF4ValueHelp = this.sF4ValueHelp.filter(function(x) {
				return (x.Code.search(sSearchValue) !== -1 || x.Description.toUpperCase().search(sSearchValue) !== -1);
			});
			this.getView().getModel("F4ValueHelpModel").setData(aF4ValueHelp);
			this.getView().getModel("F4ValueHelpModel").refresh();
		},
		onCancelPress: function() {
			history.go(-1);
		},
		_onMetadataLoaded: function() {
			// Store original busy indicator delay for the detail view
			var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
				oViewModel = this.getModel("detailView");

			// Make sure busy indicator is displayed immediately when
			// detail view is displayed for the first time
			oViewModel.setProperty("/delay", 0);

			// Binding the view will set it to not busy - so the view is always busy if it is not bound
			oViewModel.setProperty("/busy", true);
			// Restore original busy indicator delay for the detail view
			oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
		},
		onFileDeleted: function(oEvent) {
			var that = this;
			var oDeletedFile = oEvent.getSource().getBindingContext("AttachmentsModel").getProperty();
			var vId = oEvent.getSource().getId();
			var vIndex = parseInt(oEvent.getSource().getBindingContext("AttachmentsModel").getPath().substring(1, 2));
			MessageBox.confirm(oDeletedFile.FileName + " dosyası silinecek. Emin misiniz?", {
				icon: MessageBox.Icon.INFORMATION,
				title: "Dosya silme",
				actions: [MessageBox.Action.YES, MessageBox.Action.NO],
				emphasizedAction: MessageBox.Action.YES,
				onClose: function(oAction) {
					if (oAction === "YES") {
						that._deleteBackendFile(oDeletedFile, vId, vIndex);
					}
				}
			});
		},
		yeniFonksiyon: function() { //Yeni eklenen fonksiyon = dosyada değişiklik

		},
		_deleteBackendFile: function(oDeletedFile, vId, vIndex) {
			var that = this;
			var vDocumentId = oDeletedFile.DocumentId;

			var sFunctionParameters = {
				DocumentId: vDocumentId,
				ObjectKey: oDeletedFile.Reqnr
			};

			sap.ui.core.BusyIndicator.show();
			this.getView().getModel().callFunction("/DeleteAttachment", {
				method: "GET",
				urlParameters: sFunctionParameters,
				async: true,
				success: function(oReturn) {
					sap.ui.core.BusyIndicator.hide();
					if (oReturn.DeleteAttachment.IsSuccess === "X") {
						var oAttachmentModel = that.getView().getModel("AttachmentsModel");
						var aAttachments = oAttachmentModel.getData();
						aAttachments.splice(vIndex, 1);
						oAttachmentModel.setData(aAttachments);
						oAttachmentModel.refresh();
						that.getView().byId("uploadCollection").removeItem();
						MessageBox.information("Dosya silme işlemi başarılı.");
					} else {
						MessageBox.information("Dosya silme gerçekleşmedi.");
					}
				},
				error: function(oError) {
					sap.ui.core.BusyIndicator.hide();
					MessageBox.information("Beklenmedik bir hata oluştu.");
				}
			});
		}
	});

});