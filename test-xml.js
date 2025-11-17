const axios = require('axios');

const XML_PAYLOAD = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<SyncContentDocument
    xmlns="http://schema.infor.com/InforOAGIS/2"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" releaseID="9.2" versionID="2.12.0" xsi:schemaLocation="http://schema.infor.com/InforOAGIS/2 http://schema.infor.com/InforOAGIS/BODs/SyncContentDocument.xsd">
    <ApplicationArea>
        <Sender>
            <LogicalID>lid://infor.daf.daf</LogicalID>
            <ConfirmationCode>OnError</ConfirmationCode>
        </Sender>
        <CreationDateTime>2025-11-17T06:15:44.698Z</CreationDateTime>
        <BODID>infor.daf.daf:1763360144698:1659596980?ContentDocument&amp;verb=Sync</BODID>
    </ApplicationArea>
    <DataArea>
        <Sync>
            <ActionCriteria>
                <ActionExpression actionCode="Add"/>
            </ActionCriteria>
        </Sync>
        <ContentDocument>
            <DocumentID>
                <ID variationID="1763360144691">TrimBarcode-2-0-LATEST</ID>
            </DocumentID>
            <AlternateDocumentID>
                <ID>/TrimBarcode[@ITEMID = "2"]</ID>
            </AlternateDocumentID>
            <LastModificationDateTime>2025-11-17T06:15:44.516Z</LastModificationDateTime>
            <LastModificationPerson>
                <IDs>
                    <ID/>
                </IDs>
                <Name>E685B1F7-F06C-44AA-853F-A37778C97D8E</Name>
            </LastModificationPerson>
            <DocumentDateTime>2025-11-17T06:15:44.691Z</DocumentDateTime>
            <CreationDateTime>2025-11-17T06:15:44.516Z</CreationDateTime>
            <CreationPerson>
                <IDs>
                    <ID/>
                </IDs>
                <Name>E685B1F7-F06C-44AA-853F-A37778C97D8E</Name>
            </CreationPerson>
            <Version>1</Version>
            <Status>
                <Code listID="Content Document Status">Created</Code>
                <EffectiveDateTime>Mon Nov 17 06:15:44 UTC 2025</EffectiveDateTime>
                <ArchiveIndicator>false</ArchiveIndicator>
            </Status>
            <DocumentMetaData>
                <DocumentTypeID>TrimBarcode</DocumentTypeID>
                <Attribute id="Durum">
                    <RepresentativeIndicator>false</RepresentativeIndicator>
                    <AttributeType listID="Attribute Data Types">Short</AttributeType>
                    <IntegerAttributeValue>20</IntegerAttributeValue>
                </Attribute>
                <Attribute id="MDS_ID">
                    <RepresentativeIndicator>false</RepresentativeIndicator>
                    <AttributeType listID="Attribute Data Types">String</AttributeType>
                    <AttributeValue>291587f2-533b-4be6-9f5b-22754b4eed47</AttributeValue>
                </Attribute>
            </DocumentMetaData>
            <DocumentResource type="">
                <FileSize>9341</FileSize>
                <MimeType>application/vnd.openxmlformats-officedocument.spreadsheetml.sheet</MimeType>
                <FileName>TrimUpt.xlsx</FileName>
                <URL>https://idm.eu1.inforcloudsuite.com/ca/api/resources/TrimBarcode-2-1-LATEST?$token=FAKE_TOKEN</URL>
                <SHA256Hash>edceaad6a2c5bd8ba4fcb5f7f5b7943595d6cfaadc665f52ed67222ec4d261a5</SHA256Hash>
            </DocumentResource>
            <DocumentResource type="Preview">
                <MimeType>image/png</MimeType>
                <FileName>TrimBarcode-2-1-LATEST_Preview.png</FileName>
                <URL>https://idm.eu1.inforcloudsuite.com/ca/api/resources/TrimBarcode-2-1-LATEST/Preview?$token=FAKE_TOKEN</URL>
            </DocumentResource>
            <DocumentResource type="SmallPreview">
                <MimeType>image/png</MimeType>
                <FileName>TrimBarcode-2-1-LATEST_SmallPreview.png</FileName>
                <URL>https://idm.eu1.inforcloudsuite.com/ca/api/resources/TrimBarcode-2-1-LATEST/SmallPreview?$token=FAKE_TOKEN</URL>
            </DocumentResource>
            <DocumentResource type="Thumbnail">
                <MimeType>image/png</MimeType>
                <FileName>TrimBarcode-2-1-LATEST_Thumbnail.png</FileName>
                <URL>https://idm.eu1.inforcloudsuite.com/ca/api/resources/TrimBarcode-2-1-LATEST/Thumbnail?$token=FAKE_TOKEN</URL>
            </DocumentResource>
            <AccessControlListID>Public</AccessControlListID>
        </ContentDocument>
    </DataArea>
</SyncContentDocument>`;

async function testXmlProcessing() {
    try {
        console.log('🧪 XML İşleme Testi Başlıyor...');
        console.log('=' .repeat(70));

        const API_URL = 'http://localhost:3000/api/process-xml';
        
        console.log('📤 XML gönderiliyor:', API_URL);
        console.log('📦 XML uzunluğu:', XML_PAYLOAD.length, 'karakter');
        console.log('=' .repeat(70));

        const response = await axios.post(
            API_URL,
            XML_PAYLOAD,
            {
                headers: {
                    'Content-Type': 'application/xml',
                    'Accept': 'application/json'
                }
            }
        );

        console.log('✅ İşlem Başarılı!');
        console.log('=' .repeat(70));
        console.log('📊 Sonuç:');
        console.log(JSON.stringify(response.data, null, 2));
        console.log('=' .repeat(70));

        if (response.data.xmlInfo) {
            console.log('📄 XML Bilgisi:');
            console.log('  - Item ID:', response.data.xmlInfo.itemId);
            console.log('  - Doc Type:', response.data.xmlInfo.docType);
            console.log('  - Filename:', response.data.xmlInfo.filename);
            console.log('  - Document Key:', response.data.xmlInfo.documentKey);
        }

        if (response.data.summary) {
            console.log('\n📈 Özet:');
            console.log('  - Toplam Satır:', response.data.summary.totalRows);
            console.log('  - Eşleştirilen:', response.data.summary.matchedRows);
            console.log('  - Eşleştirilememiş:', response.data.summary.unmatchedRows);
            console.log('  - Yaratılan SKU:', response.data.summary.createdSKUs);
            console.log('  - Hatalı SKU:', response.data.summary.failedSKUs);
            console.log('  - Atanan Barkod:', response.data.summary.assignedBarcodes);
            console.log('  - Hatalı Barkod:', response.data.summary.failedBarcodes);
        }

        console.log('=' .repeat(70));

    } catch (error) {
        console.error('❌ Hata Oluştu!');
        console.error('=' .repeat(70));
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Hata:', error.message);
        }
        
        console.error('=' .repeat(70));
    }
}

// Test'i çalıştır
testXmlProcessing();

