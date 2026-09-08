# User Stories

## US-01: Create Supply Chain Batch

**As a** Farmer/Producer  
**I want to** create a new batch of agricultural products  
**So that** the batch can be tracked throughout the supply chain.

### Acceptance Criteria

#### Scenario 1: Successfully create a batch

Given the farmer is authenticated  
And the farmer has permission to create a batch  
When the farmer enters valid batch information  
And submits the batch creation form  
Then the system creates a new batch  
And assigns a unique batch ID

#### Scenario 2: Invalid batch information

Given the farmer is authenticated  
When the farmer submits incomplete or invalid batch information  
Then the system rejects the request  
And displays an appropriate validation message

## US-02: Update Supply Chain Event

**As a** Supply Chain Participant  
**I want to** update the status and information of a batch  
**So that** the supply chain history remains up to date.

### Acceptance Criteria

#### Scenario 1: Successfully update a batch

Given the user is authenticated  
And the user has permission to update the batch  
When the user submits valid supply chain event information  
Then the system records the new event  
And associates it with the correct batch

#### Scenario 2: Unauthorized update

Given the user is authenticated  
And the user does not have permission to update the batch  
When the user attempts to update the batch  
Then the system rejects the request

## US-03: Generate QR Code

**As a** Supply Chain Participant  
**I want to** generate a QR code for a batch  
**So that** consumers can access the batch provenance information.

### Acceptance Criteria

#### Scenario 1: Successfully generate QR code

Given a valid batch exists  
When an authorized user requests a QR code  
Then the system generates a unique QR code  
And links it to the corresponding batch

#### Scenario 2: Invalid batch

Given the requested batch does not exist  
When the user requests a QR code  
Then the system rejects the request  
And displays an appropriate error message

## US-04: View Provenance Timeline

**As a** Consumer  
**I want to** scan a QR code and view the provenance timeline  
**So that** I can verify the origin and journey of the product.

### Acceptance Criteria

#### Scenario 1: Successfully view provenance

Given a valid QR code exists  
When the consumer scans the QR code  
Then the system retrieves the corresponding batch  
And displays its provenance timeline

#### Scenario 2: Invalid QR code

Given the QR code is invalid or does not exist  
When the consumer scans the QR code  
Then the system displays an appropriate error message

## US-05: Audit Trail

**As a** System Administrator  
**I want to** view the audit history of supply chain events  
**So that** system activities can be monitored and traced.

### Acceptance Criteria

#### Scenario 1: View audit history

Given the administrator is authenticated  
And has permission to view audit records  
When the administrator requests the audit history  
Then the system displays the recorded activities

#### Scenario 2: Prevent audit modification

Given an audit record has been created  
When a user attempts to modify or delete the audit record  
Then the system prevents the modification

## US-06: Role-Based Access Control

**As a** System Administrator  
**I want to** manage user roles and permissions  
**So that** users can only access functions authorized for their roles.

### Acceptance Criteria

#### Scenario 1: Authorized access

Given a user is authenticated  
And the user has permission to access a function  
When the user requests that function  
Then the system allows the request

#### Scenario 2: Unauthorized access

Given a user is authenticated  
And the user does not have permission to access a function  
When the user requests that function  
Then the system denies the request
