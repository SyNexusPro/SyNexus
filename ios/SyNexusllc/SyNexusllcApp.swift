import SwiftUI
import RevenueCat

@main
struct SyNexusllcApp: App {
    @StateObject private var store = SubscriptionStore()

    init() {
        SubscriptionConstants.configurePurchases()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .task {
                    await store.startListening()
                }
        }
    }
}
