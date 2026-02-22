export class MockBot {
  sendMessage = jest.fn().mockResolvedValue({})
  editMessageText = jest.fn().mockResolvedValue({})
  answerCallbackQuery = jest.fn().mockResolvedValue(true)
}

export class MockRouterBot extends MockBot {
  handlers: Record<string, (payload: any) => void> = {}
  on = jest.fn((event: string, handler: (payload: any) => void) => {
    this.handlers[event] = handler
  })
}
