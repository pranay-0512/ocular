import jwt, { JwtPayload } from "jsonwebtoken"
import { EntityManager } from "typeorm"
import { UserService } from "."
import { User } from "../models/user"
import { TransactionBaseService } from "../interfaces"
import { UserRoles } from "../models/user"
import { InviteRepository } from "../repositories/invite"
import { UserRepository } from "../repositories/user"
import { ConfigModule } from "../types/config-module"
// import { ListInvite } from "../types/invites"
// import { buildQuery } from "../utils"
import {EventBusService} from "../types"
import AutoflowAiError from "../utils/error"

// 7 days
const DEFAULT_VALID_DURATION = 1000 * 60 * 60 * 24 * 7

type InviteServiceProps = {
  manager: EntityManager
  userService: UserService
  userRepository: typeof UserRepository
  inviteRepository: typeof InviteRepository
  eventBusService: EventBusService
  loggedInUser: User
}

class InviteService extends TransactionBaseService {
  static Events = {
    CREATED: "invite.created",
  }

  protected readonly userService_: UserService
  protected readonly userRepo_: typeof UserRepository
  protected readonly inviteRepository_: typeof InviteRepository
  protected readonly eventBus_:  EventBusService
  protected readonly loggedInUser_: User

  protected readonly configModule_: ConfigModule

  constructor(
    {
      userService,
      userRepository,
      inviteRepository,
      eventBusService,
      loggedInUser
    }: InviteServiceProps,
    configModule: ConfigModule
  ) {
    // @ts-ignore
    // eslint-disable-next-line prefer-rest-params
    super(...arguments)

    this.configModule_ = configModule
    this.userService_ = userService
    this.userRepo_ = userRepository
    this.inviteRepository_ = inviteRepository
    this.eventBus_ = eventBusService
    this.loggedInUser_ = loggedInUser
  }

  generateToken(data): string {
    const { jwt_secret } = this.configModule_.projectConfig
    if (jwt_secret) {
      return jwt.sign(data, jwt_secret)
    }
    throw new AutoflowAiError(
      AutoflowAiError.Types.INVALID_DATA,
      "Please configure jwt_secret"
    )
  }


  /**
   * Updates an account_user.
   * @param user - user emails
   * @param role - role to assign to the user
   * @param validDuration - role to assign to the user
   * @return the result of create
   */
  async create(
    user: string,
    role: UserRoles,
    validDuration = DEFAULT_VALID_DURATION
  ): Promise<void> {
    return await this.atomicPhase_(async (manager) => {
      const inviteRepository =
        this.activeManager_.withRepository(InviteRepository)

      const userRepo = this.activeManager_.withRepository(UserRepository)

      const userEntity = await userRepo.findOne({
        where: { email: user },
      })

      if (userEntity) {
        throw new AutoflowAiError(
          AutoflowAiError.Types.INVALID_DATA,
          "Can't invite a user with an existing account"
        )
      }

      let invite = await inviteRepository.findOne({
        where: { user_email: user },
      })
      // if user is trying to send another invite for the same account + email, but with a different role
      // then change the role on the invite as long as the invite has not been accepted yet
      if (invite && !invite.accepted && invite.role !== role) {
        invite.role = role

        invite = await inviteRepository.save(invite)
      } else if (!invite) {
        // if no invite is found, create a new one
        const created = inviteRepository.create({
          role,
          token: "",
          user_email: user,
          organisation_id: this.loggedInUser_.organisation.id,
        })

        invite = await inviteRepository.save(created)
      }

      invite.token = this.generateToken({
        invite_id: invite.id,
        role,
        user_email: user,
        organisation_id: invite.organisation_id,
      })

      invite.expires_at = new Date()
      invite.expires_at.setMilliseconds(
        invite.expires_at.getMilliseconds() + validDuration
      )

      invite = await inviteRepository.save(invite)

      await this.eventBus_
        .withTransaction(manager)
        .emit(InviteService.Events.CREATED, {
          id: invite.id,
          token: invite.token,
          organisation_name: this.loggedInUser_.organisation.name,
          user_email: invite.user_email,
        })
    })
  }
}

export default InviteService