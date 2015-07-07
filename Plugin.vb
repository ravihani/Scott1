Imports System.ServiceModel
Imports Microsoft.Xrm.Sdk
Imports Microsoft.Xrm.Sdk.Query
Imports Microsoft.Xrm.Sdk.Client
Imports Imagine.CRM.LOC.IAFRosterService

''' <summary>
''' Plugin Name     -   NicsDischargeDissociate
''' Description     -   Executes on Update of NICS entity
'''                 
''' Author/Date     -   Ravi - 04/06/2015
''' </summary>          Logic for Dissociating Individual from a facility for a NICS Discharge request
'''                             - update nics discharge date on the current individual residence address 
'''                             - update the dscharge date on DODD Packet as the loc end date
'''                             - update the discharge date on individual
''' <remarks>
''' Step #1 
'''  - Entity/Type  -   NICS
'''  - Triggers     -   dodd_facilitystatus
'''  - Images       -   Post Image(dodd_facilitystatus, dodd_individual, dodd_facility, dodd_nicstype, dodd_dischargedate)
''' </remarks>

Public Class NicsDischargeDissociate
    Implements IPlugin

    Public Const STATUS_ASSOCIATED = 100000000
    Public Const STATUS_DISSOCIATED = 100000001
    Public Const TYPE_ICF_DISCHARGE = 100000001
    Public Const REASON_ICF = 100000000


    Public Sub Execute(serviceProvider As IServiceProvider) Implements IPlugin.Execute
        Dim context As IPluginExecutionContext = DirectCast(serviceProvider.GetService(GetType(IPluginExecutionContext)), IPluginExecutionContext)
        'If context.Depth > 1 Then Return
        If context.MessageName = "Update" Then
            ProcessUpdate(context, serviceProvider)
        Else
            Return
        End If
    End Sub

    Private Sub ProcessUpdate(context As IPluginExecutionContext, serviceProvider As IServiceProvider)
        'tracing service for use in plug-in debugging.
        Dim tracingService As ITracingService = CType(serviceProvider.GetService(GetType(ITracingService)), ITracingService)

        Dim serviceFactory = DirectCast(serviceProvider.GetService(GetType(IOrganizationServiceFactory)), IOrganizationServiceFactory)
        Dim service = serviceFactory.CreateOrganizationService(context.UserId)

        Dim postImage As Entity = Nothing
        If context.PostEntityImages.Contains("PostImage") Then
            postImage = DirectCast(context.PostEntityImages("PostImage"), Entity)

            If postImage.Contains("dodd_nicstype") AndAlso postImage("dodd_nicstype") IsNot Nothing AndAlso
                 CType(postImage("dodd_nicstype"), OptionSetValue).Value.Equals(TYPE_ICF_DISCHARGE) Then

                If postImage.Contains("dodd_facilitystatus") AndAlso postImage("dodd_facilitystatus") IsNot Nothing AndAlso
                   CType(postImage("dodd_facilitystatus"), OptionSetValue).Value.Equals(STATUS_DISSOCIATED) Then
                    Dim individual As EntityReference
                    Dim facility As EntityReference
                    Dim dischargeDate As Date
                    If postImage.Contains("dodd_individual") AndAlso postImage("dodd_individual") IsNot Nothing AndAlso
                        postImage.Contains("dodd_facility") AndAlso postImage("dodd_facility") IsNot Nothing Then
                        individual = postImage.Attributes("dodd_individual")
                        facility = postImage.Attributes("dodd_facility")
                        If postImage.Contains("dodd_dischargedate") AndAlso postImage("dodd_dischargedate") IsNot Nothing Then
                            dischargeDate = postImage.Attributes("dodd_dischargedate")
                        End If

                        'Query individual address entity with the individual id and retrieve the current icf residence address
                        Dim query As XElement =
                        <fetch version="1.0" output-format="xml-platform" mapping="logical" distinct="false">
                            <entity name="dodd_individualaddress">
                                <attribute name="dodd_facility"/>
                                <attribute name="dodd_livingarrangementcategory"/>
                                <attribute name="dodd_addresstype"/>
                                <attribute name="dodd_individualid"/>
                                <attribute name="dodd_addresseffectiveenddate"/>
                                <attribute name="dodd_addresseffectivebegindate"/>
                                <filter type="and">
                                    <condition attribute="dodd_individualid" operator="eq" value=<%= individual.Id.ToString() %>/>
                                    <condition attribute="dodd_addresstype" operator="eq" value="2"/>
                                    <condition attribute="dodd_livingarrangementcategory" operator="eq" value="7"/>
                                    <condition attribute="dodd_addresseffectiveenddate" operator="null"/>
                                </filter>
                            </entity>
                        </fetch>

                        'Dim fetchXml As String = String.Format(query.ToString(), individual.Id)                        
                        Dim matches As EntityCollection = service.RetrieveMultiple(New FetchExpression(query.ToString()))

                        If matches.Entities.Count > 0 Then

                            Dim residenceAddress As Entity = matches.Entities(0)
                            If residenceAddress.Contains("dodd_facility") AndAlso residenceAddress("dodd_facility") IsNot Nothing Then
                                Dim facilityInResidenceAddress As EntityReference = residenceAddress("dodd_facility")

                                ' compare the facility on nics and residence address(icf)
                                If (facility.Name = facilityInResidenceAddress.Name) Then
                                    If (dischargeDate >= DirectCast(residenceAddress("dodd_addresseffectivebegindate"), DateTime)) Then

                                        ' 1. update individual address with nics discharge date as the address effective end date
                                        Dim addressRecord As Entity = New Entity("dodd_individualaddress")
                                        addressRecord.Id = residenceAddress.Id
                                        addressRecord("dodd_addresseffectiveenddate") = dischargeDate
                                        service.Update(addressRecord)

                                        '2. update packet with the discharge date as loc effective end date
                                        Dim flag As Boolean = updatePacketWithDischargeDate(service, individual.Id, dischargeDate)

                                        '3. update individual with the discharge date as address effective end date and set the flag for being discharged 
                                        updateIndividualWithDischargeDateAndFlag(service, individual.Id, dischargeDate, flag)

                                        '4 Call IAF service   
                                        ' Try..catch block added, if web service call fails then Ignore it.
                                        Try
                                            Dim url As Uri = New Uri(GetWebServiceEndpointUrl(service))
                                            If url IsNot Nothing Then
                                                If residenceAddress.Contains("dodd_addresseffectivebegindate") Then
                                                    CallIAFService(service, postImage, url, context.InitiatingUserId, DirectCast(residenceAddress("dodd_addresseffectivebegindate"), DateTime))
                                                Else
                                                    CallIAFService(service, postImage, url, context.InitiatingUserId, Nothing)
                                                End If
                                            End If
                                        Catch exIAF As Exception
                                            ' tracingService.Trace(exIAF.Message)
                                            Logger.Log(service, "IAF Webservice Runtime Error:", exIAF, Logger._ERROR)
                                        End Try

                                    Else
                                        Throw New Exception("Discharge date needs to be greater than the facility address effective start date which is" + residenceAddress("dodd_addresseffectivebegindate"))
                                    End If

                                Else
                                    Throw New Exception("Cannot be discharged from this facility." & vbNewLine & "The individual is associated to the facility : " + residenceAddress("dodd_facility").name)
                                End If
                            Else
                                Dim ex As New Exception("Facility name needs to be updated on the Individual's residence address")
                                Throw ex
                            End If

                        Else
                            Dim ex As New Exception("The individual is not associated with any facility." & vbNewLine & "Hence cannot be discharged from this facility ")
                            Throw ex
                        End If

                    End If
                End If
            End If
        Else
            Dim ex As New Exception("PostImage is not set.")
            Throw ex
        End If

    End Sub

    Function updatePacketWithDischargeDate(service As IOrganizationService, individualId As Guid, dischargeDate As Date) As Boolean
        Dim dischargeFlag As Boolean = False
        Dim query As XElement =
                   <fetch version="1.0" output-format="xml-platform" mapping="logical" distinct="false">
                       <entity name="dodd_locdeterminationpacket">
                           <attribute name="dodd_locdeterminationpacketid"/>
                           <attribute name="dodd_name"/>
                           <attribute name="createdon"/>
                           <attribute name="dodd_individual"/>
                           <attribute name="dodd_locdeterminationstatus"/>
                           <attribute name="dodd_locenddate"/>
                           <attribute name="dodd_loceffectivedate"/>
                           <attribute name="dodd_locreason"/>
                           <order attribute="createdon" descending="true"/>
                           <filter type="and">
                               <condition attribute="dodd_individual" operator="eq" value="{0}"/>
                           </filter>
                       </entity>
                   </fetch>

        Dim fetchXml As String = String.Format(query.ToString(), individualId)
        Dim packet As EntityCollection = service.RetrieveMultiple(New FetchExpression(fetchXml))
        If packet.Entities.Count > 0 Then
            Dim latestPacket As Entity = packet.Entities(0)
            If CType(latestPacket("dodd_locreason"), OptionSetValue).Value.Equals(REASON_ICF) Then
                If latestPacket.Contains("dodd_loceffectivedate") AndAlso latestPacket("dodd_loceffectivedate") IsNot Nothing AndAlso
                     latestPacket.Contains("dodd_locenddate") AndAlso latestPacket("dodd_locenddate") IsNot Nothing Then
                    'Check if the discharge date falls within the range of the loc effective date and loc end date, and then update the discharge date on the packet
                    If ((dischargeDate.Date >= latestPacket("dodd_loceffectivedate").Date) AndAlso (dischargeDate.Date <= latestPacket("dodd_locenddate").Date)) Then
                        Dim x As Entity = New Entity("dodd_locdeterminationpacket")
                        x.Id = latestPacket.Id
                        x("dodd_locenddate") = dischargeDate
                        service.Update(x)
                        dischargeFlag = True      ' Set Discharge flag as True if the packet is updated with the discharge date 
                    End If
                End If
            End If
        End If
        Return dischargeFlag
    End Function

    Sub updateIndividualWithDischargeDateAndFlag(service As IOrganizationService, individualId As Guid, dischargeDate As Date, flag As Boolean)
        Dim individualRecord As Entity = New Entity("account")
        individualRecord.Id = individualId
        individualRecord("dodd_nicsdischargedate") = dischargeDate
        individualRecord("dodd_nicsicfdischargeflag") = flag
        service.Update(individualRecord)
    End Sub

    Private Sub CallIAFService(service As IOrganizationService, postImage As Entity, url As Uri, UserId As Guid, IndividualAddAdmissionDate As DateTime?)
        Dim IAFService As IAFInterfaceCall = New IAFInterfaceCall(url)
        Dim dob As DateTime = Nothing
        Dim admissionDate As DateTime? = DateTime.Now ' Date tim e to send to IAF service, Just to satisfy IAF service
        Dim dischargeDate As DateTime? = Nothing
        Dim firstName As String = Nothing
        Dim lastName As String = Nothing
        Dim SSN As String = Nothing
        Dim medicaidid As String = Nothing
        Dim fullname As String = Nothing
        Dim providerNumber As Int32 = Nothing
        Dim dischargeReason As String = Nothing
        Dim ExMessageString = "Parameters for IAF service call were: "

        Try

            Dim entIndividual As Entity = GetIndividualDetails(service, DirectCast(postImage.Attributes("dodd_individual"), EntityReference).Id)
            Dim entUser As Entity = GetLoggedinUsrDetails(service, UserId)
            Dim entFacility As Entity = GetFacilityDetails(service, DirectCast(postImage.Attributes("dodd_facility"), EntityReference).Id)
            Dim entTeamRef As EntityReference = GetIAFSupportTeamName(service)



            If entIndividual.Attributes.Contains("dodd_nicsadmissiondate") Then
                admissionDate = DirectCast(entIndividual.Attributes("dodd_nicsadmissiondate"), DateTime)
            Else
                ''Check for indicidual admission date
                If IndividualAddAdmissionDate IsNot Nothing AndAlso IndividualAddAdmissionDate.HasValue Then
                    admissionDate = IndividualAddAdmissionDate.Value
                Else
                    Dim entIndividualAddress As Entity = GetIndividualAddressDetails(service, DirectCast(postImage.Attributes("dodd_individual"), EntityReference).Id)
                    If entIndividualAddress IsNot Nothing AndAlso entIndividualAddress.Attributes.Contains("dodd_addresseffectivebegindate") Then
                        admissionDate = DirectCast(entIndividualAddress.Attributes("dodd_addresseffectivebegindate"), DateTime)
                    End If
                End If
            End If

            If entIndividual.Attributes.Contains("dodd_firstname") Then
                firstName = entIndividual.Attributes("dodd_firstname")
                ExMessageString += ", firstName:" + firstName
            End If

            If entIndividual.Attributes.Contains("dodd_lastname") Then
                lastName = entIndividual.Attributes("dodd_lastname")
                ExMessageString += ", lastName:" + lastName
            End If

            If entIndividual.Attributes.Contains("dodd_ssn") Then
                SSN = entIndividual.Attributes("dodd_ssn")
                ExMessageString += ", SSN:" + SSN
            End If

            If entIndividual.Attributes.Contains("dodd_dateofbirth") Then
                dob = entIndividual.Attributes("dodd_dateofbirth")
                ExMessageString += ", dob:" + dob.ToString()
            End If

            If postImage.Attributes.Contains("dodd_dischargedate") Then
                dischargeDate = DirectCast(postImage.Attributes("dodd_dischargedate"), DateTime)
                ExMessageString += ", dischargeDate:" + dischargeDate.ToString()
            End If

            If postImage.Attributes.Contains("dodd_reasonfordischarge") Then
                dischargeReason = DirectCast(postImage("dodd_reasonfordischarge"), OptionSetValue).Value.ToString()
                ExMessageString += ", dischargeReason:" + dischargeDate
            End If

            If entIndividual.Attributes.Contains("dodd_medicaidid") Then
                medicaidid = entIndividual.Attributes("dodd_medicaidid")
                ExMessageString += ", medicaidid:" + medicaidid.ToString()
            End If

            If entUser.Attributes.Contains("fullname") Then
                fullname = entUser.Attributes("fullname")
                ExMessageString += ", fullname:" + fullname.ToString()
            End If

            If entFacility.Attributes.Contains("dodd_medicaidprovidernumber") Then
                Dim strProviderNum As String = entFacility.Attributes("dodd_medicaidprovidernumber")
                If (Int32.TryParse(strProviderNum, providerNumber)) Then
                    providerNumber = Int32.Parse(strProviderNum)
                Else
                    ExMessageString += "  ERROR: Unable to cast '" + strProviderNum + "' in to providerNumber (int32)"

                End If

                ExMessageString += ", providerNumber:" + providerNumber.ToString()
            End If
            ExMessageString += Environment.NewLine + "IAF service call starts."
            Dim response As IAF_Roster_Mgmt_Service_Data_Contract = IAFService.DischargeResident(firstName, 0, lastName, SSN, dob, dischargeDate, admissionDate, dischargeReason, medicaidid, providerNumber, fullname)
            ExMessageString += Environment.NewLine + "IAF service call successful."

            If response IsNot Nothing Then
                Dim entity As Entity = New Entity("task")

                entity.Attributes.Add("subject", "IAF-Discharge-" + response.ResponseCode)
                entity.Attributes.Add("description", response.ResponseCodeDescription + "." + Environment.NewLine + ExMessageString)


                If response.IsRequestCompletedSuccessfully Then
                    ' create Task with Green flag

                    If postImage.Attributes.Contains("dodd_completedby") Then
                        entity.Attributes.Add("ownerid", DirectCast(postImage.Attributes("dodd_completedby"), EntityReference))
                    End If

                    Dim temoOption As OptionSetValue = New OptionSetValue()
                    temoOption.Value = 0
                    entity.Attributes.Add("dodd_priority", temoOption)
                    entity.Attributes.Add("scheduledend", DateTime.Now)
                Else
                    ' create Task with Yellow flag
                    Dim temoOption As OptionSetValue = New OptionSetValue()
                    temoOption.Value = 2
                    entity.Attributes.Add("dodd_priority", temoOption)

                    entity.Attributes.Add("scheduledend", DateTime.Now.AddDays(7))

                    If entTeamRef IsNot Nothing Then
                        entity.Attributes.Add("ownerid", entTeamRef)
                    End If
                End If

                entity.Attributes.Add("regardingobjectid", New EntityReference(postImage.LogicalName, postImage.Id))
                entity.Attributes.Add("dodd_individual", DirectCast(postImage.Attributes("dodd_individual"), EntityReference))

                Dim NewTaskGuid As Guid = service.Create(entity)
                If response.IsRequestCompletedSuccessfully AndAlso NewTaskGuid <> Guid.Empty Then
                    Dim req As Microsoft.Crm.Sdk.Messages.SetStateRequest = New Microsoft.Crm.Sdk.Messages.SetStateRequest() With
                                                                            {
                                                                               .EntityMoniker = New EntityReference("task", NewTaskGuid),
                                                                               .State = New OptionSetValue(1),
                                                                               .Status = New OptionSetValue(5)
                                                                             }

                    service.Execute(req)
                End If
            End If
        Catch ex As Exception
            Throw New Exception(ex.Message + Environment.NewLine + ExMessageString)
        End Try
    End Sub

    Private Function GetIndividualDetails(crmService As IOrganizationService, Individualid As Guid) As Entity
        Dim fetchXml As XElement = <fetch version='1.0' output-format='xml-platform' mapping='logical' distinct='false'>
                                       <entity name='account'>
                                           <attribute name="dodd_lastname"/>
                                           <attribute name="dodd_firstname"/>
                                           <attribute name="dodd_doddnum"/>
                                           <attribute name="dodd_dateofbirth"/>
                                           <attribute name="dodd_medicaididmasked"/>
                                           <attribute name="dodd_medicaidid"/>
                                           <attribute name="dodd_nickname"/>
                                           <attribute name="dodd_ssn"/>
                                           <attribute name="accountid"/>
                                           <filter type="and">
                                               <condition attribute="accountid" operator="eq" uitype="account" value=<%= Individualid.ToString() %>/>
                                           </filter>
                                       </entity>
                                   </fetch>
        Dim collection As EntityCollection = RetrieveMultiple(crmService, New FetchExpression(fetchXml.ToString))

        If (collection.Entities.Count > 0) Then
            Return collection.Entities(0)
        Else
            Throw New Exception("Unable to retrieve Individual details.")
        End If
    End Function

    Private Function GetIndividualAddressDetails(crmService As IOrganizationService, Individualid As Guid) As Entity
        Dim fetchXml As XElement = <fetch version="1.0" output-format="xml-platform" mapping="logical" distinct="false">
                                       <entity name="dodd_individualaddress">
                                           <attribute name="dodd_individualaddressid"/>
                                           <attribute name="dodd_name"/>
                                           <attribute name="createdon"/>
                                           <attribute name="dodd_individualid"/>
                                           <attribute name="dodd_addresseffectivebegindate"/>
                                           <order attribute="createdon" descending="true"/>
                                           <filter type="and">
                                               <condition attribute="dodd_individualid" operator="eq" uitype="dodd_individualaddress" value=<%= Individualid.ToString() %>/>
                                           </filter>
                                       </entity>
                                   </fetch>
        Dim collection As EntityCollection = RetrieveMultiple(crmService, New FetchExpression(fetchXml.ToString))

        If (collection.Entities.Count > 0) Then
            Return collection.Entities(0)
        Else
            Throw New Exception("Unable to retrieve Individual Address details.")
        End If
    End Function

    Private Function GetLoggedinUsrDetails(crmService As IOrganizationService, userid As Guid) As Entity
        Dim fetchXml As XElement = <fetch version="1.0" output-format="xml-platform" mapping="logical" distinct="false">
                                       <entity name="systemuser">
                                           <attribute name="fullname"/>
                                           <attribute name="businessunitid"/>
                                           <attribute name="title"/>
                                           <attribute name="preferredphonecode"/>
                                           <attribute name="systemuserid"/>
                                           <attribute name="lastname"/>
                                           <attribute name="firstname"/>
                                           <order attribute="fullname" descending="false"/>
                                           <filter type="and">
                                               <condition attribute="systemuserid" operator="eq" uitype="systemuser" value=<%= userid.ToString() %>/>
                                           </filter>
                                       </entity>
                                   </fetch>

        Dim collection As EntityCollection = RetrieveMultiple(crmService, New FetchExpression(fetchXml.ToString))

        If (collection.Entities.Count > 0) Then
            Return collection.Entities(0)
        Else
            Throw New Exception("Unable to retrieve User details.")
        End If
    End Function

    Private Function GetFacilityDetails(crmService As IOrganizationService, Facilityid As Guid) As Entity
        Dim fetchXml As XElement = <fetch version="1.0" output-format="xml-platform" mapping="logical" distinct="false">
                                       <entity name="dodd_facility">
                                           <attribute name="dodd_facilityid"/>
                                           <attribute name="dodd_name"/>
                                           <attribute name="dodd_medicaidprovidernumber"/>
                                           <order attribute="dodd_name" descending="false"/>
                                           <filter type="and">
                                               <condition attribute="dodd_facilityid" operator="eq" uitype="dodd_facility" value=<%= Facilityid.ToString() %>/>
                                           </filter>
                                       </entity>
                                   </fetch>

        Dim collection As EntityCollection = RetrieveMultiple(crmService, New FetchExpression(fetchXml.ToString))

        If (collection.Entities.Count > 0) Then
            Return collection.Entities(0)
        Else
            Throw New Exception("Unable to retrieve Facility details.")
        End If
    End Function

    Private Function GetIAFSupportTeamName(crmService As IOrganizationService) As EntityReference
        Dim fetchXml As XElement = <fetch version='1.0' output-format='xml-platform' mapping='logical' distinct='false'>
                                       <entity name='dodd_sitesettings'>
                                           <attribute name='dodd_name'/>
                                           <attribute name='dodd_value'/>
                                           <attribute name='dodd_description'/>
                                           <attribute name='dodd_sitesettingsid'/>
                                           <order attribute='dodd_name' descending='false'/>
                                           <filter type='and'>
                                               <condition attribute='dodd_name' operator='eq' value='IAF_WebService_Support_Team'/>
                                           </filter>
                                       </entity>
                                   </fetch>

        Dim fetchExpression As New FetchExpression(fetchXml.ToString())
        Dim collection As EntityCollection = crmService.RetrieveMultiple(fetchExpression)

        If (collection.Entities.Count > 0) Then
            Dim Team As EntityReference = GetTeamReferenceByName(crmService, collection.Entities(0).Attributes("dodd_value"))
            If Team IsNot Nothing Then
                Return Team
            Else
                Throw New Exception("Team " + collection.Entities(0).Attributes("dodd_value") + " does not exists.")
            End If
        Else
            Throw New Exception("IAF_WebService_Support_Team's WebService Site Setting needs to be created")
        End If
    End Function

    Public Function GetTeamReferenceByName(crmService As IOrganizationService, Key As String) As EntityReference

        If Key Is Nothing Then
            Return Nothing
        End If

        Dim query As QueryExpression = New QueryExpression With { _
        .EntityName = "team",
        .ColumnSet = New ColumnSet(True)}

        query.Criteria = New FilterExpression()
        query.Criteria.AddCondition("name", ConditionOperator.Equal, {Key})

        Try

            Dim result As EntityCollection = RetrieveMultiple(crmService, query)
            If result IsNot Nothing AndAlso result.Entities IsNot Nothing AndAlso result.Entities.Count > 0 AndAlso result.Entities(0).Attributes IsNot Nothing Then
                Return New EntityReference("team", result.Entities(0).Id)
            Else
                Return Nothing
            End If
        Catch ex As Exception
            Throw ex
        End Try

        Return Nothing
    End Function

    Private Function RetrieveMultiple(service As IOrganizationService, fetch As QueryBase) As EntityCollection
        Return service.RetrieveMultiple(fetch)
    End Function

    Private Function GetWebServiceEndpointUrl(crmService As IOrganizationService) As String
        Dim fetchXml As XElement = <fetch version='1.0' output-format='xml-platform' mapping='logical' distinct='false'>
                                       <entity name='dodd_sitesettings'>
                                           <attribute name='dodd_name'/>
                                           <attribute name='dodd_value'/>
                                           <attribute name='dodd_description'/>
                                           <attribute name='dodd_sitesettingsid'/>
                                           <order attribute='dodd_name' descending='false'/>
                                           <filter type='and'>
                                               <condition attribute='dodd_name' operator='eq' value='IAF_WebService'/>
                                           </filter>
                                       </entity>
                                   </fetch>

        Dim fetchExpression As New FetchExpression(fetchXml.ToString())
        Dim collection As EntityCollection = crmService.RetrieveMultiple(fetchExpression)

        If (collection.Entities.Count > 0) Then
            Return collection.Entities(0)("dodd_value").ToString()
        Else
            Throw New Exception("IAF_Roster_Mgmt_Service's WebService Site Setting needs to be created and pointing to AEGIS WebService")
        End If
    End Function

End Class

