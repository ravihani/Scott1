/********************************************************************************************************
Script Type: Review Entity

Author: Ravi 
Description:  Review Form entity js functions 

This file has a dependency on 
1. jQuery, 
2. GlobalFunctions.js, 
3. GlobalConstants.js

*********************************************************************************************************/



if (typeof (Imagine) == "undefined")
{ Imagine = {}; }

if (typeof (Imagine.CRM) == "undefined")
{ Imagine.CRM = {}; }

if (typeof (Imagine.CRM.RDS) == "undefined")
{ Imagine.CRM.RDS = {}; }

//-------------------- Constants ------------------------

var MSG_FIRSTCOMMUNICATION = "responded to first communication?";
var MSG_REVIEWDATEPRESENT = "Review Date is available, so you can not set 'Provider Responce To Review Notification' field to 'No'.";
var MSG_ReviewDateFor90Template = "Review Start Date is missing to generate 90 day template, Please check and try again";
var MSG_90DAYSDATAMISSINGCEOInfo = "The CEO First Name or Last Name missing to generate 90 Days Notification template, Please check and try again";
var MSG_90DAYSDATAMISSINGReviewerInfo = "The Reviewer Email Address or Phone Number missing to generate 90 Days Notification template, Please check and try again";
var MSG_90DAYSDATASuccess = "The required values are available to generate 90 Days Notification template, Please save the Review to generate the template";

var MSG_90DAYSDATAMISSINGCEOEmail = "The CEO Email Address missing to generate 90 Days Notification template, Please check and try again";
var MSG_SPECIAL_TO_Normal_Review = "Provider already responded to 90 day notification.\n You can not change the review type.";
var MSG_REVIEW_TYPE_CHANGE = "Provider already responded to 90 day notification.\n You can not change the review type.";
var REVIE_NAME = "";
//---------------------------------------------------------

var reviewFormat_OnSite = "Onsite Review";
var reviewFormat_Desk = "Desk Review";

var Is_PageOnLoad = false;
var FORMLOADED = false;
var Is_90DayEmailSent = false;


var user = null;



Imagine.CRM.RDS.Review =
    {
        IsCrlDisabled: function (Ctrl)
        {
            if (Xrm.Page.ui.controls.get(Ctrl) != null &&
                Xrm.Page.ui.controls.get(Ctrl).getDisabled() != null &&
                Xrm.Page.ui.controls.get(Ctrl).getDisabled() == true)
            {

                return true;
            }
            return false;
        },
        DisableControl: function (Ctrl)
        {
            if (Xrm.Page.ui.controls.get(Ctrl) != null)
            {
                Xrm.Page.ui.controls.get(Ctrl).setDisabled(true);
            }
        },
        EnableControl: function (Ctrl)
        {
            if (Xrm.Page.ui.controls.get(Ctrl) != null)
            {
                Xrm.Page.ui.controls.get(Ctrl).setDisabled(false);
            }
        },
        SetNullControl: function (Ctrl)
        {
            if (Xrm.Page.getAttribute(Ctrl) != null)
            {
                Xrm.Page.getAttribute(Ctrl).setValue(null);
            }
        },
        ShowHideControl: function (Ctrl, val)
        {
            if (Xrm.Page.getControl(Ctrl) != null)
            {
                Xrm.Page.getControl(Ctrl).setVisible(val);
            }
        },

        UserBusinessUnit: function ()
        {
            if (user == null)
            {
                return;
            }

            userBusinessUnitInfo = getUserBusinessUnitInfo(user.substring(1, 37));

            if (userBusinessUnitInfo != null & userBusinessUnitInfo[0].name != null)
            {

                LOGGED_IN_USER_BUSINESS_UNIT_NAME = userBusinessUnitInfo[0].name;
                LOGGED_IN_USER_BUSINESS_UNIT_GUID = userBusinessUnitInfo[0].id;

                if (userBusinessUnitInfo[0].countycode != null)
                {
                    LOGGED_IN_USER_BUSINESS_UNIT_COUNTYCODE = userBusinessUnitInfo[0].countycode;
                }
            }
        },

        NewReview: function ()
        {

            //Step 1. Disable Provider
            if (FROM_TYPE != null && (FROM_TYPE == FORM_TYPE_CREATE))
            {
                if (Xrm.Page.getAttribute(ATB_PROVIDER) == null)
                {
                    Xrm.Page.ui.controls.get(ATB_PROVIDER).setDisabled(false)
                    Xrm.Page.ui.controls.get(ATB_COUNTY).setDisabled(false)
                }
            }

            //Step 1. Disable Other controls           
            ATB_To_Disable_On_Load.forEach(function (itm) { Imagine.CRM.RDS.Review.DisableControl(itm) });
            ATB_To_Hide_On_Load.forEach(function (itm) { Imagine.CRM.RDS.Review.ShowHideControl(itm, false) });
            this.ShowORHideTab("tab_SpecialReview", false);
        },


        countyLoadBusinessUnitCheck: function ()
        {


            var user = Xrm.Page.context.getUserId();
            BusinessUnitInfo = getUserBusinessUnitInfo(user.substring(1, 37));

            if (BusinessUnitInfo[0].name != "DODD")
            {
                if (BusinessUnitInfo[0].countycode != null)
                {
                    this.loadOptionSetCheck(BusinessUnitInfo[0].countycode);
                    var optionsetField = Xrm.Page.getAttribute("dodd_county");

                    if (Xrm.Page.getAttribute("dodd_iscountyboardreview").getValue() != true)
                    {
                        Xrm.Page.getAttribute("dodd_iscountyboardreview").setValue(true);
                        Xrm.Page.getAttribute("dodd_iscountyboardreview").setSubmitMode("always");
                    }
                }
            }
            else
            {

                Xrm.Page.getControl("dodd_county").setDisabled(false);
            }
        },
        loadOptionSetCheck: function (countycode)
        {
            var optionsetField = Xrm.Page.getAttribute("dodd_county");
            var Options = optionsetField.getOptions();

            var advanceOption = new Option();
            var countycodevalue;
            var countyIndexId;

            for (i = 0; i < Options.length; i++)
            {

                if (optionsetField.getOptions()[i].text == countycode)
                {
                    countycodevalue = optionsetField.getOptions()[i].value;
                    countyIndexId = i;
                    break;
                }
            }

            if (Xrm.Page.getAttribute("dodd_county").getValue() == null)
            {
                optionsetField.setValue(optionsetField.getOptions()[i].value);
                Xrm.Page.getAttribute("dodd_county").setSubmitMode("always");
            }

        },


        OnLoad: function ()
        {
            //Script 


            user = Xrm.Page.context.getUserId();
            Is_PageOnLoad = true;

            onloadReview_StartDate = null;
            onloadReview_Date = null;

            // setTimeout(function () { Imagine.CRM.RDS.Review.UserBusinessUnit(); }, 0010);
            Imagine.CRM.RDS.Review.UserBusinessUnit();
            //--------------Added for Review Date required ----------------------------
            if (Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED) != null || Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED).getValue() != null)
            {
                var atbFirstRv = Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED);
                if (atbFirstRv.getValue() == true)
                {
                    Xrm.Page.getAttribute(ATB_REVIEWDATE).setRequiredLevel("required");
                }
                else
                {
                    Xrm.Page.getAttribute(ATB_REVIEWDATE).setRequiredLevel("none");
                }
            }
            //------------------------------------------------------------------------------

            if (Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE) != null && Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).getValue() != null)
            {
                onloadReview_StartDate = Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).getValue();
            }
            if (Xrm.Page.getAttribute(ATB_REVIEWDATE) != null && Xrm.Page.getAttribute(ATB_REVIEWDATE).getValue() != null)
            {
                onloadReview_Date = Xrm.Page.getAttribute(ATB_REVIEWDATE).getValue();
            }




            FROM_TYPE = Xrm.Page.ui.getFormType();
            this.preFilterLookup();

            this.RemoveOptionsFromCounty();
            this.countyLoadBusinessUnitCheck();
            //onFormLoadUserTeam();

            setTimeout(function () { Imagine.CRM.RDS.Review.HideSections(); }, 0010);

            if (FROM_TYPE != null && (FROM_TYPE == FORM_TYPE_CREATE))
            {
                this.NewReview();
            }
            else if ((!FORMLOADED) || (FROM_TYPE != null && (FROM_TYPE == FORM_TYPE_UPDATE)))
            {

                //<Defect Fix for, Reviewer assign contact for special revierw  --- Start ---- >
                Xrm.Page.ui.controls.get(ATB_CONTACTREVIEW).setDisabled(false);
                Xrm.Page.ui.controls.get(ATB_CONTACTREVIEW).setRequiredLevel("required");
                //<Defect Fix for, Reviewer assign contact for special revierw  --- End ---- >

                ATB_To_Disable_For_Update.forEach(function (itm) { Imagine.CRM.RDS.Review.DisableControl(itm) });

                this.GetContactsAssociatedWithProvider();


                if (Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION) && Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION).getValue() != null &&
                   Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION).getValue() == true)
                {
                    Is_90DayEmailSent = true;
                }
            }



            this.validateReviewDateBusinessLogic();
            FORMLOADED = true;

        },


        OnSave: function (execObj)
        {

            var reviewType = this.GetReviewTypeName(ATB_REVIEW_TYPE);

            if (reviewType && reviewType != null && reviewType == REVIEW_TYPE_SPECIAL_Name)
            {

                Xrm.Page.ui.controls.get(ATB_READYTOSEND90DAYNOTIFICATION).setDisabled(true);
                Xrm.Page.getControl(ATB_READYTOSEND90DAYNOTIFICATION).setVisible(false);

                var atbRvType = Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION)
                if (atbRvType != null && atbRvType.getValue() != null)
                {
                    if (atbRvType.getValue() == false)
                    {
                        Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION).setValue(true)
                    }
                }
                var atb45DayEmailSend = Xrm.Page.getAttribute(ATB_45THDAYEMAILSEND)
                if (atb45DayEmailSend != null && atb45DayEmailSend.getValue() != null)
                {
                    if (atb45DayEmailSend.getValue() == false)
                    {
                        Xrm.Page.getAttribute(ATB_45THDAYEMAILSEND).setValue(true)
                    }
                }

            }
            else
            {

            }
            //Is_PageOnLoad = true;

            if (FROM_TYPE != null && (FROM_TYPE == FORM_TYPE_UPDATE))
            {
                this.validateReviewDateBusinessLogic();
            }
            this.HideSections();

            if (Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION) && Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION).getValue() != null &&
                               Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION).getValue() == true)
            {
                Xrm.Page.ui.controls.get(ATB_READYTOSEND90DAYNOTIFICATION).setDisabled(true);

                if (!Is_90DayEmailSent)
                {
                    Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION).setSubmitMode("always");


                    if (Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE) != null && Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).getValue() != null)
                    {
                        Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).setSubmitMode("always");
                    }
                }


            }
            else
            {
                Xrm.Page.ui.controls.get(ATB_READYTOSEND90DAYNOTIFICATION).setDisabled(false);
            }



            if (Xrm.Page.getAttribute(ATB_FIRSTNOTIFICATIONDUEDATE) && Xrm.Page.getAttribute(ATB_FIRSTNOTIFICATIONDUEDATE).getValue() == null)
            {
                if (Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE) != null && Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).getValue() != null)
                    Xrm.Page.getAttribute(ATB_FIRSTNOTIFICATIONDUEDATE).setValue(Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).getValue() + 14)
            }


        },


        ReLoadForm: function ()
        {
            window.location.reload(true);
        },


   

        RemoveOptionsFromCounty: function ()
        {
            //debugger
            var control = Xrm.Page.ui.controls.get("dodd_county");
            control.removeOption(89);//All
            control.removeOption(99);//Out
            //
        },

        preFilterLookup: function ()
        {
            Xrm.Page.getControl("dodd_reviewerid").addPreSearch(function ()
            {

                fetchXml = "<filter type='and'>";
                fetchXml += "<condition attribute='dodd_rdsreviewer' operator='eq' value='1' />";
                if (LOGGED_IN_USER_BUSINESS_UNIT_NAME != "DODD")
                {
                    fetchXml += "<condition attribute='businessunitidname' operator='eq'   value='" + LOGGED_IN_USER_BUSINESS_UNIT_NAME + "' />";
                }
                fetchXml += "</filter>";

                Imagine.CRM.RDS.Review.addLookupFilter(fetchXml, 'dodd_reviewerid');
            });

            Xrm.Page.getControl("dodd_groupmanagerid").addPreSearch(function ()
            {
                fetchXml = "<filter type='and'>";
                fetchXml += "<condition attribute='dodd_rdsgroupmanager' operator='eq' value='1' />";
                if (LOGGED_IN_USER_BUSINESS_UNIT_NAME != "DODD")
                {
                    fetchXml += "<condition attribute='businessunitidname' operator='eq'   value='" + LOGGED_IN_USER_BUSINESS_UNIT_NAME + "' />";
                }
                fetchXml += "</filter>";

                Imagine.CRM.RDS.Review.addLookupFilter(fetchXml, 'dodd_groupmanagerid');
            });

            Xrm.Page.getControl("dodd_doddgroupmanagerid").addPreSearch(function ()
            {
                fetchXml = "<filter type='and'>";
                fetchXml += "<condition attribute='businessunitidname' operator='eq'   value='DODD' />";
                fetchXml += "</filter>";

                Imagine.CRM.RDS.Review.addLookupFilter(fetchXml, 'dodd_doddgroupmanagerid');
            });


            if (LOGGED_IN_USER_BUSINESS_UNIT_NAME != "DODD")
            {
                if (Xrm.Page.getAttribute(ATB_DODDGROUPMANAGERID) != null)
                {
                    Xrm.Page.getAttribute(ATB_DODDGROUPMANAGERID).setRequiredLevel("required")
                }
            }
            else
            {
                if (Xrm.Page.getAttribute(ATB_DODDGROUPMANAGERID) != null)
                {
                    Xrm.Page.getAttribute(ATB_DODDGROUPMANAGERID).setRequiredLevel("none")
                    Xrm.Page.getControl(ATB_DODDGROUPMANAGERID).setVisible(false);
                }
            }


        },

        addLookupFilter: function (fetchXml, lookupCtrl)
        {
            Xrm.Page.getControl(lookupCtrl).addCustomFilter(fetchXml);
        },

        filterFacility: function ()
        {

            var entityName = "dodd_facility";
            var Providerlookupfield = Xrm.Page.getAttribute("dodd_providerid").getValue();
            if (Providerlookupfield == null) return;
            var viewDisplayName = "Associated Facilities";
            var viewId = "{00000000-0000-0000-AAAA-000010001004}";

            var ftxml = "";
            ftxml += "<fetch version='1.0' mapping='logical' distinct='true' > ";
            ftxml += "<entity name='dodd_facility'>";
            ftxml += "<attribute name='dodd_name'/>";
            ftxml += "<attribute name='dodd_facilityid'/>";
            ftxml += "<attribute name='dodd_facilitynumber'/>";
            ftxml += "<attribute name='dodd_facilitytype'/>";
            ftxml += "<link-entity name='dodd_dodd_facility_competitor' from='dodd_facilityid' to='dodd_facilityid' > ";
            ftxml += "<link-entity name='competitor' from='competitorid' to='competitorid' >";
            ftxml += "<filter type='and'>";
            ftxml += "      <condition attribute='competitorid' operator='eq' value='" + Providerlookupfield[0].id + "' />";
            ftxml += "   </filter>";
            ftxml += "</link-entity>";
            ftxml += "</link-entity>";
            ftxml += "</entity>";
            ftxml += "</fetch>";

            var layoutXml = "<grid name='FacitiliesResults' object='2' jump='dodd_facilityid' select='1' icon='0' preview='0'>" +
            "<row name='result' id='dodd_facilityid'>" +
            "<cell name='dodd_name' width='200' />" +
            "<cell name='dodd_facilitynumber' width='150' />" +
            "<cell name='dodd_facilitytype' width='150' />" +
            "</row>" +
            "</grid>";
            Xrm.Page.getControl(ATB_FACILITYID).addCustomView(viewId, entityName, viewDisplayName, ftxml, layoutXml, true);



        },
        EnableORDisableSection: function (sectionname, disablestatus)
        {
            var ctrlName = Xrm.Page.ui.controls.get();

            for (var i in ctrlName)
            {
                var ctrl = ctrlName[i];
                if (ctrl.getParent() != null)
                {
                    var ctrlSection = ctrl.getParent().getName();
                    if (ctrlSection == sectionname)
                    {
                        ctrl.setDisabled(disablestatus);
                    }
                }
            }
        },

        ShowORHideTab: function (tabName, val)
        {
            if (Xrm.Page.ui.tabs.get(tabName) && Xrm.Page.ui.tabs.get(tabName).getVisible() != null)
            {
                if (Xrm.Page.ui.tabs.get(tabName).getVisible() != null)
                {
                    Xrm.Page.ui.tabs.get(tabName).setVisible(val);
                }
            }
        },

        AlwaysSubmitControls: function ()
        {
            Xrm.Page.getAttribute(ATB_NAME).setSubmitMode("always");
        },

        CheckBusinessRules: function ()
        {

            if (Xrm.Page.getAttribute(ATB_REVIEWDATE) != null && Xrm.Page.getAttribute(ATB_REVIEWDATE).getValue() != null)
            {
                if (Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED) != null && Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED).getValue() != null)
                {
                    if (Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED).getValue() == false)
                    {
                        Xrm.Utility.alertDialog(MSG_REVIEWDATEPRESENT, null);
                        Xrm.Page.context.getEventArgs().preventDefault();
                    }
                }
            }

        },



        OnChangeProvider: function ()
        {



            if (this.GetProviderAgencyType())
            {

                // onFormLoadUserTeam();
                this.countyLoadBusinessUnitCheck();
                var tmpArr = [ATB_FACILITYID, ATB_REVIEW_TYPE, ATB_REVIEW_FORMAT]; //, ATB_CONTACTREVIEW
                if (Xrm.Page.getAttribute(ATB_PROVIDER) != null)
                {
                    tmpArr.forEach(function (itm) { Imagine.CRM.RDS.Review.EnableControl(itm) });
                    this.GetContactsAssociatedWithProvider();
                }
                else
                {
                    tmpArr.forEach(function (itm) { Imagine.CRM.RDS.Review.SetNullControl(itm) });
                    tmpArr.forEach(function (itm) { Imagine.CRM.RDS.Review.DisableControl(itm) });
                }

                this.ReviewName();
                this.filterFacility();
            }
            else
            {
                alert("The Agency Type is missing and You can't select this Provider")
                Xrm.Page.getAttribute("dodd_providerid").setValue(null);
            }
        },

        OnChangeCouny: function ()
        {

            this.ReviewName();
            this.GetCountyFullName();
        },

        OnChangeReviewDate: function ()
        {

            this.ValidateDate(ATB_REVIEWDATE);
        },
        validateReviewDateBusinessLogic: function ()
        {

            var ctrlFirstRv = Xrm.Page.getControl(ATB_FIRSTCOMMUNICATIONRECEIVED);
            //

            if (FROM_TYPE != null && (FROM_TYPE == FORM_TYPE_UPDATE))
            {


                if (Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED) != null || Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED).getValue() != null)
                {
                    var atbFirstRv = Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED)
                    if (atbFirstRv.getValue() == false)
                    {
                        //if (atbFirstRv)
                        //{
                        //    atbFirstRv.setValue(false);
                        //}

                        var atbReadyTo90Day = Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION)
                        if (atbReadyTo90Day != null && atbReadyTo90Day.getValue() == false)
                        {
                            Xrm.Page.getAttribute(ATB_REVIEWDATE).setValue(null);
                        }

                        Xrm.Page.ui.controls.get(ATB_REVIEWDATE).setDisabled(true)

                    }
                    else if (atbFirstRv.getValue() == true)
                    {

                        Xrm.Page.getAttribute(ATB_CONTACTREVIEW).setRequiredLevel("required")
                        Xrm.Page.ui.controls.get(ATB_REVIEWDATE).setDisabled(false)

                        //Xrm.Utility.confirmDialog(msg,
                        //    function ()
                        //    {
                        //        Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED).setValue(true);
                        //        Xrm.Page.ui.controls.get(ATB_REVIEWDATE).setDisabled(false);
                        //        Xrm.Page.ui.controls.get(ATB_READYTOSEND90DAYNOTIFICATION).setDisabled(true);

                        //    },
                        //    function ()
                        //    {
                        //        Xrm.Page.getAttribute(ATB_REVIEWDATE).setValue(null);
                        //        //== Xrm.Page.getAttribute(ATB_CONTACTREVIEW).setValue(null);
                        //        Xrm.Page.ui.controls.get(ATB_REVIEWDATE).setDisabled(true)
                        //        //==  Xrm.Page.ui.controls.get(ATB_CONTACTREVIEW).setDisabled(true);

                        //        Xrm.Page.getAttribute(ATB_REVIEWDATE).setRequiredLevel("none");
                        //        Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED).setValue(false);
                        //    }
                        //    );

                    }
                }
            }

        },

        OnChangeFirstCommunication: function ()
        {
            return;
            var msg = MSG_FIRSTCOMMUNICATION;
            Xrm.Page.ui.clearFormNotification(ATB_REVIEWDATE);
            var ctrlFirstRv = Xrm.Page.getControl(ATB_FIRSTCOMMUNICATIONRECEIVED);
            //

            if (FROM_TYPE != null && (FROM_TYPE == FORM_TYPE_UPDATE))
            {


                if (Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED) != null || Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED).getValue() != null)
                {
                    var atbFirstRv = Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED)
                    if (atbFirstRv.getValue() == false)
                    {
                        if (atbFirstRv)
                        {
                            atbFirstRv.setValue(false);
                        }

                        Xrm.Page.getAttribute(ATB_REVIEWDATE).setValue(null);

                        Xrm.Page.ui.controls.get(ATB_REVIEWDATE).setDisabled(true)

                        //==Xrm.Page.ui.controls.get(ATB_CONTACTREVIEW).setDisabled(true);
                        //==Xrm.Page.getAttribute(ATB_CONTACTREVIEW).setValue(null);
                    }
                    else if (atbFirstRv.getValue() == true)
                    {
                        //ctrlFirstRv.setVisible(false);
                        Xrm.Page.getAttribute(ATB_CONTACTREVIEW).setRequiredLevel("required")
                        Xrm.Page.ui.controls.get(ATB_REVIEWDATE).setDisabled(false)


                        //---
                        //== Xrm.Page.ui.controls.get(ATB_CONTACTREVIEW).setDisabled(false);

                        var provider = null;
                        if (Xrm.Page.getAttribute(ATB_PROVIDER) != null)
                        {
                            provider = new Array();
                            provider = Xrm.Page.getAttribute(ATB_PROVIDER).getValue();
                            if (provider != null && provider[0] != null && provider[0].name != "")
                            {

                                msg = "Did [" + provider[0].name + "] " + MSG_FIRSTCOMMUNICATION;
                            }
                        }

                        Xrm.Utility.confirmDialog(msg,
                            function ()
                            {
                                Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED).setValue(true);
                                Xrm.Page.ui.controls.get(ATB_REVIEWDATE).setDisabled(false);
                                Xrm.Page.ui.controls.get(ATB_READYTOSEND90DAYNOTIFICATION).setDisabled(true);
                                Xrm.Page.ui.clearFormNotification('firstcommunication');

                            },
                            function ()
                            {
                                Xrm.Page.getAttribute(ATB_REVIEWDATE).setValue(null);
                                //== Xrm.Page.getAttribute(ATB_CONTACTREVIEW).setValue(null);
                                Xrm.Page.ui.controls.get(ATB_REVIEWDATE).setDisabled(true)
                                //==  Xrm.Page.ui.controls.get(ATB_CONTACTREVIEW).setDisabled(true);

                                Xrm.Page.getAttribute(ATB_REVIEWDATE).setRequiredLevel("none");
                                Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED).setValue(false);
                            }
                            );

                    }
                }
            }


        },

        OnChangeStartReviewDate: function ()
        {
            this.IsStartReviewDate();
        },

        IsStartReviewDate: function ()
        {
            Xrm.Page.ui.controls.get(ATB_REVIEWDATE).setDisabled(true);
            if (Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION) != null && Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION).getValue() != null)
            {
                if (Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION).getValue() == true)
                {
                    Xrm.Page.ui.controls.get(ATB_REVIEWDATE).setDisabled(false);
                    return true;
                }
            }

            return false;
        },

        SetFirstCommunication: function (val)
        {
            Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED).setValue(val);
        },

        ReviewName: function ()
        {
            REVIE_NAME = "";
            var provider = null;
            if (Xrm.Page.getAttribute(ATB_PROVIDER) != null)
            {
                provider = new Array();
                provider = Xrm.Page.getAttribute(ATB_PROVIDER).getValue();
                if (provider != null && provider[0] != null && provider[0].name != "")
                {
                    REVIE_NAME = provider[0].name + " - ";
                }
            }

            var ctrl = Xrm.Page.getAttribute(ATB_COUNTY)
            if (ctrl && ctrl.getSelectedOption() != null)
            {
                ctrl.getSelectedOption().text;

                REVIE_NAME = REVIE_NAME + ctrl.getSelectedOption().text + " - ";
            }


            var today = new Date()
            today.getYear();
            REVIE_NAME = REVIE_NAME + today.getFullYear();

            Xrm.Page.getAttribute(ATB_NAME).setValue(REVIE_NAME);

        },

        GetCountyFullName: function ()
        {
            var ctrl = Xrm.Page.getAttribute(ATB_COUNTY);
            if (ctrl && ctrl.getSelectedOption() != null)
            {
                var CountyFullName = GetCountyNameByCountyCode(ctrl.getSelectedOption().value).Name;
                if (CountyFullName != null)
                {
                    Xrm.Page.getAttribute("dodd_countyfullname").setValue(CountyFullName);
                    Xrm.Page.getAttribute("dodd_countyfullname").setSubmitMode('always');
                }
                else
                {
                    alert("County is Missing Fullname ,Please check before generate 90 days template");
                }
            }
        },

        OnChangeReviewType: function ()
        {

            this.SpecialTypeOfReview();
        },

        SpecialTypeOfReview: function ()
        {


            var reviewType = this.GetReviewTypeName(ATB_REVIEW_TYPE);
            var ctrl = Xrm.Page.getControl(ATB_REASON_4_SPECIAL_RV);
            var ctrlFirstRv = Xrm.Page.getControl(ATB_FIRSTCOMMUNICATIONRECEIVED);
            var ctrl90dayRes = Xrm.Page.getControl(ATB_READYTOSEND90DAYNOTIFICATION);

            var atbFirstRv = Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED);
            var atb90dayRes = Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION)

            if (Is_PageOnLoad == false && atbFirstRv != null && atbFirstRv.getValue() != null)
            {
                if (Xrm.Page.getAttribute(ATB_FIRSTCOMMUNICATIONRECEIVED).getValue() == true)
                {
                    Xrm.Utility.alertDialog(MSG_REVIEW_TYPE_CHANGE, null);
                    return;
                }
            }

            /*  if (Is_PageOnLoad == false && atb90dayRes != null && atb90dayRes.getValue() != null) {
                  if (atb90dayRes.getValue() == true) {
                      Xrm.Utility.alertDialog(MSG_REVIEW_TYPE_CHANGE, null);
                      return;
                  }
              }*/


            if (reviewType && reviewType != null && reviewType == REVIEW_TYPE_SPECIAL_Name)
            {

                if (FROM_TYPE != null && (FROM_TYPE == FORM_TYPE_CREATE))
                {


                    ATB_To_Hide_For_SpecialReview.forEach(function (itm) { Imagine.CRM.RDS.Review.ShowHideControl(itm, false) });
                    Xrm.Page.ui.controls.get(ATB_REVIEWDATE).setDisabled(false);

                    Xrm.Page.ui.controls.get(ATB_REVIEWDATE).setRequiredLevel("required");

                    atb90dayRes.setValue(true);
                    ctrl90dayRes.setVisible(false);
                    atb90dayRes.setSubmitMode("always");

                    atbFirstRv.setValue(false);
                    ctrlFirstRv.setVisible(false);
                    atbFirstRv.setSubmitMode("always");

                    this.ShowORHideTab("tab_SpecialReview", true);
                    Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).setValue((new Date()));
                    var TmpDate = Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).getValue();

                    // Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).setValue((new Date()).getHours(), (new Date()).getMinutes(), (new Date()).getSeconds());
                    Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).setValue(TmpDate.setHours((new Date()).getHours(), (new Date()).getMinutes(), 0));

                    this.SetOptionSetByOptionText(ATB_REVIEW_FORMAT, reviewFormat_OnSite);

                    if (ctrl)
                    {
                        ctrl.setVisible(true);
                        Xrm.Page.getAttribute(ATB_REASON_4_SPECIAL_RV).setValue(REVIEW_TYPE_SPECIAL_UserValue);
                        if (ctrlFirstRv)
                        {
                            atbFirstRv.setValue(false);
                            ctrlFirstRv.setVisible(false);
                        }
                    }
                }

                else if (FROM_TYPE != null && (FROM_TYPE == FORM_TYPE_UPDATE))
                {
                    Xrm.Page.ui.controls.get(ATB_REVIEWDATE).setRequiredLevel("required");
                    ATB_To_Disable_For_SpecialReview.forEach(function (itm) { Imagine.CRM.RDS.Review.DisableControl(itm) });

                    this.SetOptionSetByOptionText(ATB_REVIEW_FORMAT, reviewFormat_OnSite);
                    if (Is_PageOnLoad == false)
                    {
                        [ATB_REVIEW_TYPE, ATB_REVIEW_FORMAT].forEach(function (itm) { Imagine.CRM.RDS.Review.EnableControl(itm) });

                        if (Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE) && Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).getValue() == null)
                        {
                            Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).setValue((new Date()));
                        }
                        else
                        {
                            [ATB_REVIEWSTARTDATE].forEach(function (itm) { Imagine.CRM.RDS.Review.DisableControl(itm) });
                        }

                        if (Xrm.Page.getAttribute(ATB_REVIEWDATE) && Xrm.Page.getAttribute(ATB_REVIEWDATE).getValue() == null)
                        {
                            Xrm.Page.getAttribute(ATB_REVIEWDATE).setValue((new Date()));
                        }
                        else
                        {

                        }
                    }


                    ctrl90dayRes.setVisible(false);
                    ctrlFirstRv.setVisible(false);

                }

            }
            else
            {
                if (FROM_TYPE != null && (FROM_TYPE == FORM_TYPE_CREATE))
                {
                    this.ShowORHideTab("tab_SpecialReview", false);
                    Xrm.Page.ui.controls.get(ATB_REVIEWDATE).setDisabled(true);
                    Xrm.Page.getAttribute(ATB_REVIEWDATE).setValue(null);
                    Xrm.Page.getAttribute(ATB_REVIEWDATE).setRequiredLevel("none");
                    Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).setValue(null);
                    Xrm.Page.getAttribute(ATB_SPECIALREVIEWREASON).setValue(null);
                    Xrm.Page.getAttribute(ATB_SPECIALREVIEWREASON).setValue(null);
                    Xrm.Page.getAttribute(ATB_SPECIALREVIEWANNOUNCED).setValue(false);
                    Xrm.Page.getAttribute(ATB_TIMEFORREVIEWCOMPLETION).setValue(null);
                    atb90dayRes.setValue(false);
                    atb90dayRes.setSubmitMode("always");
                }
                else if (FROM_TYPE != null && (FROM_TYPE == FORM_TYPE_UPDATE))
                {
                    //  
                    ctrl90dayRes.setVisible(true);
                    //Xrm.Page.ui.controls.get(ATB_READYTOSEND90DAYNOTIFICATION).setDisabled(false);
                    if (Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION) != null && Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION).getValue() != null)
                    {
                        if (Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION).getValue() == false)
                        {
                            Xrm.Page.ui.controls.get(ATB_REVIEWDATE).setDisabled(false);

                        }
                    }

                    if (Is_PageOnLoad == false)
                    {

                        //onloadReview_Date
                        // onloadReview_StartDate


                        Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).setValue(onloadReview_StartDate);
                        Xrm.Page.getAttribute(ATB_REVIEWDATE).setValue(onloadReview_Date);

                    }
                }
            }


        },

        GetReviewTypeValue: function (ctrlName)
        {
            var ctrl = Xrm.Page.getAttribute(ctrlName)
            if (ctrl && ctrl.getSelectedOption() != null)
            {
                var reviewType = ctrl.getSelectedOption().text;
            }
            return null;
        },

        GetReviewTypeName: function (ctrlName)
        {

            var ctrl = Xrm.Page.getAttribute(ctrlName)
            if (ctrl && ctrl.getSelectedOption() != null)
            {
                return ctrl.getSelectedOption().text;
            }
            return null;
        },

        SetOptionSetByOptionText: function (ctrlName, optionText)
        {
            if (optionText == null && Xrm.Page.getAttribute(ctrlName) != null)
            {

                Xrm.Page.getAttribute(ctrlName).setValue(null);
                return;
            }

            var options = Xrm.Page.getAttribute(ctrlName).getOptions();
            for (i = 0; i < options.length; i++)
            {
                if (options[i].text == optionText)
                {
                    Xrm.Page.getAttribute(ctrlName).setValue(options[i].value);
                    return;
                }
            }
        },
       
        GetContactsAssociatedWithProvider: function ()
        {

            Xrm.Page.getControl("dodd_contactreviewid").addPreSearch(function ()
            {
                var entityName = "contact";
                var Providerlookupfield = Xrm.Page.getAttribute("dodd_providerid").getValue();
                if (Providerlookupfield == null) return;

                var fetchXml = "<filter type='and'>";
                fetchXml += "<condition attribute='dodd_contactid' operator='eq'   value='" + Providerlookupfield[0].id + "' />";
                fetchXml += "</filter>";

                Imagine.CRM.RDS.Review.addLookupFilter(fetchXml, 'dodd_contactreviewid');
            });                   
        },
        GetCEOInfoFromProvider: function ()
        {

            // Imagine.CRM.RDS.Review.Get90DaysAfterCurrentDate();

            var provider = null;
            if (Xrm.Page.getAttribute("dodd_providerid") != null)
            {
                provider = new Array();
                provider = Xrm.Page.getAttribute("dodd_providerid").getValue();
            }
            var daysValue90 = null;
            daysValue90 = Xrm.Page.getAttribute("dodd_readytosend90daysnotifiation").getValue();

            if (daysValue90 == READYTOSEND90DAYNOTIFICATION_NO)//value=No
            {
                var atbRvStDate = Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE)
                if (atbRvStDate != null && atbRvStDate.getValue() != null)
                {
                    Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).setValue(null)
                }

                return;
            }

            if (this.GetReviewerDetails())
            {

                if (provider != null && provider[0] != null)
                {


                    var name = provider[0].name;
                    var guid = provider[0].id;
                    var entType = provider[0].entityType;
                    var objectEntity = this.RetrieveEntity("competitor", "CompetitorSet", "CompetitorId", guid, "dodd_ceofirstname,dodd_ceolastname,dodd_ceoemailaddress");
                    if (objectEntity != null)
                    {
                        if (objectEntity.dodd_ceofirstname == null && objectEntity.dodd_ceolastname == null)
                        {
                            Xrm.Utility.alertDialog(MSG_90DAYSDATAMISSINGCEOInfo, null);
                            Xrm.Page.getAttribute("dodd_readytosend90daysnotifiation").setValue(READYTOSEND90DAYNOTIFICATION_NO); //Set back to no
                            return;
                        }
                        if (objectEntity.dodd_ceoemailaddress == null)
                        {
                            Xrm.Utility.alertDialog(MSG_90DAYSDATAMISSINGCEOEmail, null);
                            Xrm.Page.getAttribute("dodd_readytosend90daysnotifiation").setValue(READYTOSEND90DAYNOTIFICATION_NO); //Set back to no
                            return;
                        }


                        Xrm.Utility.confirmDialog(MSG_90DAYSDATASuccess,
                         function ()
                         {
                             Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).setValue((new Date()));
                             var TmpDate = Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).getValue();
                             Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).setValue(TmpDate.setHours((new Date()).getHours(), (new Date()).getMinutes(), 0));

                         },
                        function ()
                        {
                            var atb90dayRes = Xrm.Page.getAttribute(ATB_READYTOSEND90DAYNOTIFICATION)
                            if (atb90dayRes)
                            {
                                atb90dayRes.setValue(false);
                            }
                            Xrm.Page.getAttribute(ATB_REVIEWSTARTDATE).setValue(null);
                        }
                        );

                    }
                }
            }

        },
        SaveDataAndRefresh: function ()
        {

            Xrm.Page.data.save();
            Xrm.Page.data.refresh();

        },
        RetrieveEntity: function (EntityName, EntitySetName, IdColumn, Id, ColumnNames)
        {
            if (EntityName != null && Id != null && ColumnNames != null)
            {
                var oDataSelect = "/" + EntitySetName + "?$select=" + ColumnNames + "&$filter=" + IdColumn + " eq guid'" + Id + "'";
                return querySingleEntity(oDataSelect);
            }
            else if (EntityName != null && Id != null && ColumnNames == null)
            {
                var oDataSelect = "/" + EntitySetName + "?$filter=" + IdColumn + " eq guid'" + Id + "'";
                return querySingleEntity(oDataSelect);
            }
        },


    };



