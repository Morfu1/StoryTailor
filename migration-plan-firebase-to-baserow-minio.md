# Firebase to Baserow + MinIO Migration Plan

## Executive Summary

This document outlines a comprehensive migration plan from Firebase (Firestore + Firebase Storage) to a self-hosted solution using Baserow (PostgreSQL-based database) and MinIO (S3-compatible storage). Firebase Auth will remain unchanged due to its generous free tier (50,000 MAU).

## Current Firebase Architecture Analysis

### Database (Firestore)
- **Collections**: `stories`, `userApiKeys`
- **Key Documents**: Story objects with complex nested structures
- **Data Types**: 
  - Rich media URLs (audio, images)
  - Timestamp fields (`createdAt`, `updatedAt`)
  - Array fields (`narrationChunks`, `generatedImages`, `timelineTracks`)
  - User references and metadata

### Storage (Firebase Storage)
- **Structure**: `users/{userId}/stories/{storyId}/`
- **File Types**: Audio chunks, generated images
- **Access Pattern**: 7-day signed URLs for secure access
- **Current Size**: Unknown (needs assessment)

### Authentication (Firebase Auth)
- **Current Usage**: User management, session handling
- **Integration**: Deep integration with Firestore security rules
- **Recommendation**: **Keep Firebase Auth** (free up to 50K MAU)

## Target Architecture

### Database: Baserow (PostgreSQL)
- **Type**: Relational database with REST API
- **Access**: HTTP REST API with authentication tokens
- **UI**: Web-based interface for data management

### Storage: MinIO
- **Type**: S3-compatible object storage
- **Access**: AWS S3 SDK compatible
- **Features**: Bucket policies, presigned URLs, Docker deployment

### Authentication: Firebase Auth (No Change)
- **Rationale**: 
  - Free tier covers 50,000 monthly active users
  - Well-integrated with existing codebase
  - Mature authentication features
  - Cost-effective compared to alternatives

## Migration Strategy

### Phase 1: Environment Setup (Week 1)

#### 1.1 Docker Infrastructure (Already Running)

**MinIO Container:**
```bash
# Create data directory
mkdir -p ~/minio/data

docker run -d \
  --name minio \
  --network n8n-baserow-net \
  -p 9100:9000 \
  -p 9101:9001 \
  -v ~/minio/data:/data \
  -e "MINIO_ROOT_USER=admin" \
  -e "MINIO_ROOT_PASSWORD=Maslina12#Calda" \
  -e "MINIO_BROWSER_REDIRECT_URL=http://192.168.31.251:9101" \
  --restart unless-stopped \
  quay.io/minio/minio server /data --console-address ":9001" --address ":9000"
```

**Baserow Container:**
```bash
docker run -d \
  --name baserow \
  --network n8n-baserow-net \
  -e BASEROW_PUBLIC_URL=http://192.168.31.251:8980 \
  -e BASEROW_EXTRA_ALLOWED_HOSTS='baserow,localhost,192.168.31.251' \
  -e BASEROW_BACKEND_CORS_ALLOW_ORIGINS="http://192.168.31.251:8980,http://baserow,http://localhost:8980" \
  -p 8980:80 \
  -v baserow_data:/baserow/data \
  --restart unless-stopped \
  baserow/baserow:latest
```

**Access URLs:**
- MinIO Console: http://192.168.31.251:9101
- MinIO API: http://192.168.31.251:9100
- Baserow: http://192.168.31.251:8980

#### 1.2 Baserow Database Schema Design

**Stories Table Structure:**
```
Table: stories
- id (Primary Key, Auto-increment)
- firebase_story_id (Text, Unique) - for migration mapping
- user_id (Text) - Firebase UID
- title (Text)
- content (Long Text)
- status (Single Select: draft, generating, completed, error)
- created_at (Date)
- updated_at (Date)
- narration_audio_url (URL)
- generated_images (Long Text - JSON array)
- narration_chunks (Long Text - JSON array)
- timeline_tracks (Long Text - JSON array)
- settings (Long Text - JSON)
```

**User API Keys Table:**
```
Table: user_api_keys
- id (Primary Key, Auto-increment)
- user_id (Text) - Firebase UID
- api_key_hash (Text)
- created_at (Date)
- last_used (Date)
```

### Phase 2: Data Migration (Week 2)

#### 2.1 Export Firebase Data
```typescript
// Migration script structure
interface MigrationScript {
  exportFirestoreData(): Promise<void>;
  transformData(): Promise<void>;
  importToBaserow(): Promise<void>;
  migrateStorageFiles(): Promise<void>;
  validateMigration(): Promise<void>;
}
```

#### 2.2 Storage Migration Process
1. **Inventory Current Files**: Scan all Firebase Storage buckets
2. **Download Files**: Batch download with retry logic
3. **Upload to MinIO**: Preserve folder structure
4. **Update URLs**: Transform Firebase URLs to MinIO URLs
5. **Validation**: Verify file integrity and accessibility

#### 2.3 MinIO Bucket Structure
```
Buckets:
- storytailor-media
  └── users/
      └── {userId}/
          └── stories/
              └── {storyId}/
                  ├── narration_chunks/
                  └── images/
```

### Phase 3: Code Migration (Week 3-4)

#### 3.1 Database Layer Updates

**Current Firestore Operations → Baserow REST API**
```typescript
// Before (Firestore)
const doc = await dbAdmin.collection('stories').doc(id).get();

// After (Baserow)
const response = await fetch(`http://192.168.31.251:8980/api/database/tables/${STORIES_TABLE_ID}/rows/${id}/`, {
  headers: { 'Authorization': `Token ${BASEROW_TOKEN}` }
});
```

#### 3.2 Storage Layer Updates

**Current Firebase Storage → MinIO S3**
```typescript
// Before (Firebase)
import { getStorage } from 'firebase-admin/storage';

// After (MinIO)
import { S3Client } from '@aws-sdk/client-s3';
const s3Client = new S3Client({
  endpoint: 'http://192.168.31.251:9100',
  credentials: { accessKeyId: 'admin', secretAccessKey: 'Maslina12#Calda' },
  forcePathStyle: true,
  region: 'us-east-1'
});
```

#### 3.3 New Abstraction Layers
Create service layers to abstract database and storage operations:

```typescript
// services/database.service.ts
interface DatabaseService {
  createStory(story: Story): Promise<Story>;
  getStory(id: string): Promise<Story>;
  updateStory(id: string, updates: Partial<Story>): Promise<Story>;
  deleteStory(id: string): Promise<void>;
  getUserStories(userId: string): Promise<Story[]>;
}

// services/storage.service.ts
interface StorageService {
  uploadFile(path: string, file: Buffer): Promise<string>;
  getSignedUrl(path: string, expiresIn: number): Promise<string>;
  deleteFile(path: string): Promise<void>;
}
```

### Phase 4: Testing & Validation (Week 4)

#### 4.1 Data Integrity Checks
- Compare record counts between Firebase and Baserow
- Validate data structure and types
- Check file accessibility and URLs
- Test authentication flows

#### 4.2 Performance Testing
- API response times (Firestore vs Baserow REST)
- File upload/download speeds (Firebase Storage vs MinIO)
- Concurrent operations handling

#### 4.3 Integration Testing
- End-to-end story creation workflow
- File upload and processing pipeline
- User dashboard functionality
- Authentication edge cases

### Phase 5: Deployment & Cutover (Week 5)

#### 5.1 Staged Rollout
1. **Read-Only Mode**: Deploy new code reading from both systems
2. **Dual Write**: Write to both Firebase and new system
3. **Validation Period**: Monitor for 48 hours
4. **Full Cutover**: Switch reads to new system
5. **Firebase Cleanup**: Archive or delete Firebase data

#### 5.2 Rollback Plan
- Keep Firebase data intact for 30 days
- Feature flags to quickly revert to Firebase
- Database backup before cutover
- Monitoring and alerting setup

## Technical Implementation Details

### Environment Variables Updates
```env
# New variables needed
BASEROW_API_URL=http://192.168.31.251:8980/api
BASEROW_TOKEN=your_api_token
BASEROW_STORIES_TABLE_ID=123
BASEROW_API_KEYS_TABLE_ID=124

MINIO_ENDPOINT=http://192.168.31.251:9100
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=Maslina12#Calda
MINIO_BUCKET_NAME=storytailor-media
MINIO_REGION=us-east-1
MINIO_FORCE_PATH_STYLE=true
```

### File Updates Required

#### Database Operations
- `src/actions/firestoreStoryActions.ts` → `src/actions/baserowStoryActions.ts`
- `src/lib/firebaseAdmin.ts` → `src/lib/baserow.ts`
- Update all components reading from Firestore

#### Storage Operations  
- `src/actions/firebaseStorageActions.ts` → `src/actions/minioStorageActions.ts`
- Update file upload/download utilities
- Modify URL generation logic

#### Configuration
- Update `next.config.js` for new domains
- Modify CORS settings for MinIO
- Update environment variable usage

## Migration Scripts

### Data Export Script
```typescript
// scripts/export-firebase-data.ts
export async function exportFirebaseData() {
  const stories = await dbAdmin.collection('stories').get();
  const apiKeys = await dbAdmin.collection('userApiKeys').get();
  
  // Export to JSON files
  await writeFile('stories-export.json', JSON.stringify(stories.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))));
  
  // Export storage file inventory
  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles();
  await writeFile('storage-inventory.json', JSON.stringify(files.map(f => f.name)));
}
```

### Data Import Script
```typescript
// scripts/import-to-baserow.ts
export async function importToBaserow() {
  const stories = JSON.parse(await readFile('stories-export.json', 'utf8'));
  
  for (const story of stories) {
    await fetch(`http://192.168.31.251:8980/api/database/tables/${STORIES_TABLE_ID}/rows/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${BASEROW_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transformStoryData(story))
    });
  }
}
```

## Cost Analysis

### Current Firebase Costs (Estimated)
- **Firestore**: ~$25-50/month (based on reads/writes)
- **Firebase Storage**: ~$20-40/month (based on storage + bandwidth)
- **Firebase Auth**: FREE (under 50K MAU)
- **Total**: ~$45-90/month

### New Infrastructure Costs
- **Server/VPS**: $20-40/month (for Docker hosting)
- **Baserow**: FREE (self-hosted)
- **MinIO**: FREE (self-hosted)  
- **Firebase Auth**: FREE (keeping existing)
- **Total**: ~$20-40/month

**Estimated Savings**: $25-50/month (30-55% reduction)

## Risks & Mitigation

### Technical Risks
1. **Data Loss**: Comprehensive backup strategy + validation scripts
2. **Downtime**: Staged rollout with rollback capabilities
3. **Performance**: Load testing before cutover
4. **Auth Integration**: Keep Firebase Auth to minimize risk

### Operational Risks
1. **Self-Hosting**: Docker containerization + monitoring
2. **Backup/Recovery**: Automated backup scripts
3. **Scaling**: MinIO clustering, Baserow scaling options
4. **Maintenance**: Documentation + runbooks

## Success Criteria

### Functional Requirements
- [ ] All existing features work identically
- [ ] No data loss during migration
- [ ] Authentication remains seamless
- [ ] File upload/download functionality preserved
- [ ] API response times within 20% of current performance

### Non-Functional Requirements
- [ ] 99.9% uptime during migration
- [ ] Rollback capability within 1 hour
- [ ] Complete data audit trail
- [ ] Cost reduction achieved
- [ ] Self-hosting infrastructure stable

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| 1. Setup | Week 1 | Docker environment, Baserow schema |
| 2. Migration | Week 2 | Data export/import, storage migration |
| 3. Code Changes | Week 3-4 | API updates, service layers |
| 4. Testing | Week 4 | Validation, performance tests |
| 5. Deployment | Week 5 | Staged rollout, cutover |

**Total Timeline**: 5 weeks

## Conclusion

This migration plan provides a comprehensive, low-risk approach to moving from Firebase to Baserow + MinIO while retaining Firebase Auth. The staged approach allows for thorough testing and easy rollback if issues arise. Key benefits include cost savings, data ownership, and infrastructure control while maintaining system functionality and performance.

## Next Steps

1. Review and approve this migration plan
2. Set up development environment with Baserow + MinIO
3. Create detailed migration scripts
4. Begin Phase 1 implementation

**Recommendation**: Proceed with this migration plan, keeping Firebase Auth for cost-effectiveness and reduced complexity.
