import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ApplicationContext } from "@/context/context"
import { IconEdit } from "@tabler/icons-react"
import { FC, useContext } from "react"
import { WithTooltip } from "../ui/with-tooltip"

interface ChatSecondaryButtonsProps {}

export const ChatSecondaryButtons: FC<ChatSecondaryButtonsProps> = ({}) => {
  const { selectedChat } = useContext(ApplicationContext)

  const { handleNewChat } = useChatHandler()

  return (
    <div>
      {selectedChat && (
        <>
          <WithTooltip
            delayDuration={200}
            display={<div>New Chat</div>}
            trigger={
              <div className="bg-custom-gray dark:bg-muted mt-1 rounded-xl p-2">
                <IconEdit
                  className="cursor-pointer hover:opacity-50"
                  size={24}
                  onClick={handleNewChat}
                />
              </div>
            }
          />
        </>
      )}
    </div>
  )
}
