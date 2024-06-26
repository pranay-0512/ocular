import {
  IndexableDocument,
  AppNameDefinitions,
  IEventBusService,
  INDEX_DOCUMENT_EVENT,
  BatchJobCreateProps,
  OCULAR_API_INDEXING_TOPIC,
  APPS_INDEXING_TOPIC,
} from "@ocular/types";
import {
  defaultSearchIndexingProductRelations,
  indexTypes,
} from "../utils/search";
import OrganisationService from "../services/organisation";
import { BatchJobService, QueueService, UserService } from "../services";
import { Organisation, User } from "../models";
import JobSchedulerService from "../services/job-scheduler";
import { ConfigModule, Logger } from "../types";
import { SearchEngineOptions } from "../types/search/options";
import api from "../api";
import IndexerService from "../services/indexer";
import { SEARCH_INDEX_EVENT } from "../loaders/search";
import { orgIdToIndexName } from "@ocular/utils";
import AppAuthorizationService from "../services/app-authorization";

type InjectedDependencies = {
  indexerService: IndexerService;
  eventBusService: IEventBusService;
  batchJobService: BatchJobService;
  organisationService: OrganisationService;
  jobSchedulerService: JobSchedulerService;
  queueService: QueueService;
  configModule: ConfigModule;
  logger: Logger;
  indexName: string;
};

class SearchIndexingSubscriber {
  private readonly indexerService_: IndexerService;
  private readonly eventBusService_: IEventBusService;
  private readonly batchJobService_: BatchJobService;
  private readonly organisationService_: OrganisationService;
  private readonly jobSchedulerService_: JobSchedulerService;
  private readonly queueService_: QueueService;
  private readonly configModule_: ConfigModule;
  private readonly logger_: Logger;
  private readonly indexName_: string;

  constructor({
    indexerService,
    eventBusService,
    batchJobService,
    organisationService,
    jobSchedulerService,
    queueService,
    configModule,
    logger,
    indexName,
  }: InjectedDependencies) {
    this.indexerService_ = indexerService;
    this.batchJobService_ = batchJobService;
    this.organisationService_ = organisationService;
    this.eventBusService_ = eventBusService;
    this.jobSchedulerService_ = jobSchedulerService;
    this.queueService_ = queueService;
    this.logger_ = logger;
    this.eventBusService_.subscribe(SEARCH_INDEX_EVENT, this.buildSearchIndex);
    this.eventBusService_.subscribe(
      AppAuthorizationService.Events.TOKEN_GENERATED,
      this.addSearchIndexingJob
    );
    this.eventBusService_.subscribe(
      AppAuthorizationService.Events.WEB_CONNECTOR_INSTALLED,
      this.addSearchIndexingJobWebConnector
    );
    this.indexName_ = indexName;
    this.logger_ = logger;
  }

  // Builds The Initial Search Index Based On the Installed Apps
  buildSearchIndex = async (): Promise<void> => {
    this.logger_.info(`buildSearchIndex: Building Search Index`);
    // Step 1: Create and Index in Qdrant
    await this.indexerService_.createIndex(this.indexName_);

    // Step 2: Register Search Index Consumers To Consume Indexable Documents From the SEARCH_INDEX_QUEUE Sent By Apps
    this.queueService_.subscribeBatch(
      APPS_INDEXING_TOPIC,
      async (docs: IndexableDocument[], topic) => {
        // Start Tracking The Activity of The Indexing Process
        this.logger_.info(
          `searchIndexingConsumer: Indexing  ${docs.length} messages in topic ${topic} and index ${this.indexName_}`
        );
        await this.indexerService_.indexDocuments(this.indexName_, docs);
        this.logger_.info(
          `searchIndexingConsumer: Finished Indexing ${docs.length} messages in topic ${topic} and index ${this.indexName_}`
        );
      },
      { groupId: "ocular-apps-group" }
    );

    // Step 3: Register Search Index Consumers To Consume Indexable Documents From the SEARCH_INDEX_API Sent By Ocular API
    this.queueService_.subscribe(
      OCULAR_API_INDEXING_TOPIC,
      async (docs: IndexableDocument[], topic) => {
        this.logger_.info(`Indexing API Document ${docs.length}`);
        await this.indexerService_.indexOcularApiDocuments(
          this.indexName_,
          docs
        );
        this.logger_.info(`Indexing API Document Done`);
      },
      { groupId: "ocular-api-group" }
    );

    // // Step 4: Schedule Indexing Jobs For To Index Data From Apps Installed By Organisations
    // const orgs: Organisation[] = await this.organisationService_.list({});
    // orgs.forEach((org) => {
    //   if (!org.installed_apps) return;
    //   this.jobSchedulerService_.create(
    //     `Sync Apps Data for ${org.name}`,
    //     { org: org },
    //     "*/10 * * * *",
    //     async () => {
    //       org.installed_apps.forEach((app) => {
    //         this.logger_.error(
    //           `Schedule an Indexing Job for ${app.name} for ${org.name}`
    //         );
    //         const jobProps: BatchJobCreateProps = {
    //           type: app.name,
    //           context: {
    //             org: org,
    //           },
    //           // created_by: "system",
    //           dry_run: false,
    //         };
    //         this.batchJobService_.create(jobProps);
    //       });
    //     }
    //   );
    // });
  };

  addSearchIndexingJobWebConnector = async (data): Promise<void> => {
    const { organisation, app_name, link, link_id, org_id } = data;
    const jobProps: BatchJobCreateProps = {
      type: app_name,
      context: {
        org: organisation,
        link: link,
        link_id,
      },
      // created_by: "system",
      dry_run: false,
    };
    this.batchJobService_.create(jobProps);
  };

  // Schedules An Indexing Job when an App is installed by an Organization.
  addSearchIndexingJob = async (data): Promise<void> => {
    const { organisation, app_name } = data;

    if (app_name === AppNameDefinitions.WEBCONNECTOR) {
      return;
    }

    // Immediate job
    (async () => {
      const jobProps: BatchJobCreateProps = {
        type: app_name,
        context: {
          org: organisation,
        },
        // created_by: "system",
        dry_run: false,
      };
      await this.batchJobService_.create(jobProps);
    })();

    // Scheduled job
    this.jobSchedulerService_.create(
      `Sync Apps Data for ${organisation.name}`,
      { org: organisation },
      "0 0 * * *", // This will run the job every 24 hours at midnight
      async () => {
        const jobProps: BatchJobCreateProps = {
          type: app_name,
          context: {
            org: organisation,
          },
          // created_by: "system",
          dry_run: false,
        };
        this.batchJobService_.create(jobProps);
      }
    );
  };
}

export default SearchIndexingSubscriber;
