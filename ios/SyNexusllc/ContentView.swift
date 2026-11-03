import SwiftUI
import RevenueCat
import RevenueCatUI

struct ContentView: View {
    @EnvironmentObject private var store: SubscriptionStore
    @State private var showPaywall = false
    @State private var showCustomerCenter = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text("SyNexus")
                    .font(.largeTitle.bold())
                Text(statusText)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)

                if store.isPro {
                    Button("Manage subscription") {
                        showCustomerCenter = true
                    }
                    .buttonStyle(.borderedProminent)
                } else {
                    Button("Subscribe") {
                        showPaywall = true
                    }
                    .buttonStyle(.borderedProminent)
                    packageRow("Lifetime", package: store.lifetimePackage)
                    packageRow("Yearly", package: store.yearlyPackage)
                    packageRow("Monthly", package: store.monthlyPackage)
                }

                Button("Restore purchases") {
                    Task { await store.restore() }
                }

                if let errorMessage = store.errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }
            }
            .padding()
            .navigationTitle("SyNexus Pro")
            .toolbar {
                if store.isPro {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            showCustomerCenter = true
                        } label: {
                            Image(systemName: "person.crop.circle")
                        }
                        .accessibilityLabel("Customer Center")
                    }
                }
            }
            .sheet(isPresented: $showPaywall) {
                PaywallView()
                    .onPurchaseCompleted { info in
                        store.apply(info)
                        if info.hasSyNexusPro {
                            showPaywall = false
                        }
                    }
                    .onRestoreCompleted { info in
                        store.apply(info)
                        if info.hasSyNexusPro {
                            showPaywall = false
                        }
                    }
            }
            .sheet(isPresented: $showCustomerCenter) {
                CustomerCenterView()
                    .onCustomerCenterRestoreCompleted { info in
                        store.apply(info)
                    }
                    .onCustomerCenterRestoreFailed { error in
                        store.errorMessage = error.localizedDescription
                    }
            }
            .presentPaywallIfNeeded(
                requiredEntitlementIdentifier: SubscriptionConstants.entitlementID,
                purchaseCompleted: { info in
                    store.apply(info)
                },
                restoreCompleted: { info in
                    store.apply(info)
                }
            )
        }
    }

    private var statusText: String {
        if store.isPro {
            if let product = store.customerInfo?.synexusProProductID {
                return "SyNexus Pro is active (\(product))."
            }
            return "SyNexus Pro is active."
        }
        return "Unlock SyNexus Pro with lifetime, yearly, or monthly."
    }

    @ViewBuilder
    private func packageRow(_ title: String, package: Package?) -> some View {
        if let package {
            Button("\(title) · \(package.storeProduct.localizedPriceString)") {
                Task { await store.purchase(package) }
            }
            .buttonStyle(.bordered)
        }
    }
}
